/**
 * MAMMA IA POS - Estadisticas
 */
(function() {
    var state = {
        filteredStats: {
            total: 0, count: 0, dishCount: 0, avgDishes: 0,
            topSauces: [], topPastas: [], topCombinations: [],
            ordersByDay: { labels: [], data: [] },
            ordersByHour: { labels: [], data: [] },
            weeklyBreakdown: [],
            avgPrepTime: null, minPrepTime: null, maxPrepTime: null
        },
        dateFrom: '',
        dateTo: '',
        isRangeMode: false,
        currentFilter: 'today',
        comboLimit: 5,
        chartsInitialized: false,
        historyOrders: [],
        historyPage: 0,
        historyPageSize: 20,
        hasMoreHistory: false,
        showHistoryModal: false
    };

    var methods = {
        setFilter: function(mode) {
            this.currentFilter = mode;
            var range = this.getDatesForMode(mode);
            this.dateFrom = range.start;
            this.dateTo = range.end;
            this.isRangeMode = ['week', 'prevWeek', 'month'].includes(mode);
            this.loadOrdersForRange();
        },

        getDatesForMode: function(mode) {
            var today = new Date();
            var fmt = function(d) {
                return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            };
            var dStr = fmt(today);

            if (mode === 'today') return { start: dStr, end: dStr };
            if (mode === 'yesterday') {
                var y = new Date(today);
                y.setDate(today.getDate() - 1);
                return { start: fmt(y), end: fmt(y) };
            }
            if (mode === 'week') {
                var d = today.getDay() || 7;
                var start = new Date(today);
                if (d !== 1) start.setHours(-24 * (d - 1));
                return { start: fmt(start), end: dStr };
            }
            if (mode === 'prevWeek') {
                var startPW = new Date(today);
                var cd = today.getDay() || 7;
                startPW.setDate(today.getDate() - cd - 6);
                var endPW = new Date(startPW);
                endPW.setDate(startPW.getDate() + 6);
                return { start: fmt(startPW), end: fmt(endPW) };
            }
            if (mode === 'month') {
                var startM = new Date(today.getFullYear(), today.getMonth(), 1);
                return { start: fmt(startM), end: dStr };
            }
            return { start: dStr, end: dStr };
        },

        initStatsWithData: function() {
            var filters = ['today', 'yesterday', 'week', 'prevWeek', 'month'];
            this.findDataWithFilter(filters, 0);
        },

        findDataWithFilter: function(filters, index) {
            if (index >= filters.length) {
                this.setFilter('month');
                var self = this;
                setTimeout(function() { self.renderCharts(); }, 200);
                return;
            }

            var filter = filters[index];
            var range = this.getDatesForMode(filter);
            var self = this;

            db.ref('orders').orderByChild('date').startAt(range.start).endAt(range.end + '\uf8ff').once('value', function(s) {
                var data = s.val();
                var orders = data ? Object.values(data) : [];

                if (orders.length > 0) {
                    self.setFilter(filter);
                    setTimeout(function() { self.renderCharts(); }, 200);
                } else {
                    self.findDataWithFilter(filters, index + 1);
                }
            });
        },

        /**
         * Calcula estadísticas de ventas basadas en filteredOrders.
         * Genera rankings de salsas, pastas, combinaciones, y datos para gráficos.
         * Actualiza this.filteredStats con los resultados.
         */
        calculateStats: function() {
            try {
                if (!this.config || !Array.isArray(this.config.pastas)) return;

                var os = this.filteredOrders;
                var total = os.reduce(function(s, o) { return s + o.total; }, 0);

                var sauces = {};
                (this.config.salsas || []).forEach(function(s) { sauces[s.name] = 0; });

                var pastas = {};
                var self = this;
                (this.config.pastas || []).forEach(function(p) {
                    if (p.hasMasa) {
                        (self.config.masas || []).forEach(function(m) {
                            if (self.isMasaAllowed(p, m.name)) pastas[p.name + ' ' + m.name] = 0;
                        });
                    } else {
                        pastas[p.name] = 0;
                    }
                });

                var combinations = {};
                var dishesByDay = {};
                var dishesByHour = {};
                var dishCount = 0;

                os.forEach(function(o) {
                    (o.items || []).forEach(function(i) {
                        if (i.type === 'dish') {
                            dishCount++;

                            dishesByDay[o.date] = (dishesByDay[o.date] || 0) + 1;

                            var hour;
                            if (o.scheduledTime) {
                                hour = parseInt(o.scheduledTime.split(':')[0], 10);
                            } else if (o.timestamp && o.timestamp > APP_CONSTANTS.MIN_VALID_TIMESTAMP) {
                                hour = new Date(o.timestamp).getHours();
                            }
                            if (hour !== undefined) {
                                dishesByHour[hour] = (dishesByHour[hour] || 0) + 1;
                            }

                            if (i.salsa) sauces[i.salsa] = (sauces[i.salsa] || 0) + 1;
                            var fullName = i.pasta + (i.masa !== 'Normal' ? ' ' + i.masa : '');
                            pastas[fullName] = (pastas[fullName] || 0) + 1;
                            if (i.salsa) {
                                var comboName = fullName + ' + ' + i.salsa;
                                combinations[comboName] = (combinations[comboName] || 0) + 1;
                            }
                        }
                    });
                });

                var topSauces = Object.entries(sauces).map(function(e) { return { name: e[0], count: e[1] }; }).sort(function(a, b) { return b.count - a.count; });
                var topPastas = Object.entries(pastas).map(function(e) { return { name: e[0], count: e[1] }; }).sort(function(a, b) { return b.count - a.count; });
                var topCombinations = Object.entries(combinations).map(function(e) { return { name: e[0], count: e[1] }; }).sort(function(a, b) { return b.count - a.count; });

                if (this.comboLimit !== 'all') topCombinations = topCombinations.slice(0, parseInt(this.comboLimit));

                var uniqueDates = new Set(os.map(function(o) { return o.date; })).size || 1;
                var avgDishes = Math.round(dishCount / uniqueDates);

                // Grafico dias
                var dayChartData;
                if (!this.isRangeMode && this.dateFrom === this.dateTo) {
                    var weekRange = this.getWeekRange(this.dateFrom);
                    var allDays = this.generateWeekDays(weekRange.start);
                    dayChartData = {
                        labels: allDays.map(function(d) { return self.formatShortDate(d); }),
                        data: allDays.map(function(d) { return dishesByDay[d] || 0; })
                    };
                    this.loadWeekDishData(weekRange.start, weekRange.end, allDays);
                } else {
                    var dayLabels = Object.keys(dishesByDay).sort();
                    dayChartData = {
                        labels: dayLabels.map(function(d) { return self.formatShortDate(d); }),
                        data: dayLabels.map(function(d) { return dishesByDay[d]; })
                    };
                }

                // Grafico horas
                var hourLabels = [];
                var hourData = [];
                for (var h = 10; h <= 22; h++) {
                    hourLabels.push(h + ':00');
                    hourData.push(dishesByHour[h] || 0);
                }

                var weeklyBreakdown = this.calculateWeeklyBreakdown(os);

                // Calcular tiempo promedio de preparación
                var prepTimes = [];
                os.forEach(function(o) {
                    if (o.readyTimestamp && o.status === 'Listo') {
                        var referenceTime;
                        if (o.scheduledTime && o.date) {
                            var parts = o.scheduledTime.split(':').map(Number);
                            var scheduledDate = new Date(o.date + 'T12:00:00');
                            scheduledDate.setHours(parts[0], parts[1], 0, 0);
                            referenceTime = scheduledDate.getTime();
                        } else if (o.timestamp) {
                            referenceTime = o.timestamp;
                        }
                        if (referenceTime) {
                            var prepMins = Math.floor((o.readyTimestamp - referenceTime) / 60000);
                            if (prepMins >= 0 && prepMins < 180) { // Solo tiempos razonables (< 3 horas)
                                prepTimes.push(prepMins);
                            }
                        }
                    }
                });

                var avgPrepTime = null, minPrepTime = null, maxPrepTime = null;
                if (prepTimes.length > 0) {
                    avgPrepTime = Math.round(prepTimes.reduce(function(a, b) { return a + b; }, 0) / prepTimes.length);
                    minPrepTime = Math.min.apply(null, prepTimes);
                    maxPrepTime = Math.max.apply(null, prepTimes);
                }

                this.filteredStats = {
                    total: total,
                    count: os.length,
                    dishCount: dishCount,
                    avgDishes: avgDishes,
                    topSauces: topSauces,
                    topPastas: topPastas,
                    topCombinations: topCombinations,
                    ordersByDay: dayChartData,
                    ordersByHour: { labels: hourLabels, data: hourData },
                    weeklyBreakdown: weeklyBreakdown,
                    avgPrepTime: avgPrepTime,
                    minPrepTime: minPrepTime,
                    maxPrepTime: maxPrepTime
                };

                if (this.view === 'stats') {
                    var renderSelf = this;
                    setTimeout(function() { renderSelf.renderCharts(); }, 150);
                }
            } catch (e) {
                console.error('Error stats:', e);
            }
        },

        calculateWeeklyBreakdown: function(orders) {
            if (!orders || orders.length === 0) return [];

            var weekMap = {};
            var self = this;

            orders.forEach(function(order) {
                if (!order.date) return;

                var date = new Date(order.date + 'T12:00:00');
                var weekKey = self.getWeekOfYear(date);
                var weekStart = self.getWeekStart(date);

                if (!weekMap[weekKey]) {
                    weekMap[weekKey] = {
                        weekNum: weekKey,
                        weekStart: weekStart,
                        dishes: 0,
                        orders: 0,
                        total: 0,
                        daysWithOrders: new Set()
                    };
                }

                weekMap[weekKey].orders++;
                weekMap[weekKey].total += order.total || 0;
                weekMap[weekKey].daysWithOrders.add(order.date);
                (order.items || []).forEach(function(item) {
                    if (item.type === 'dish') weekMap[weekKey].dishes++;
                });
            });

            var weeks = Object.values(weekMap).sort(function(a, b) {
                return new Date(a.weekStart) - new Date(b.weekStart);
            });

            return weeks.map(function(w, idx) {
                var startDate = new Date(w.weekStart);
                var endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);

                var startDay = startDate.getDate();
                var endDay = endDate.getDate();
                var month = startDate.toLocaleDateString('es-CL', { month: 'short' });

                var activeDays = w.daysWithOrders.size;
                var avgPerDay = activeDays > 0 ? Math.round(w.dishes / activeDays * 10) / 10 : 0;

                return {
                    weekNum: w.weekNum,
                    weekStart: w.weekStart,
                    dishes: w.dishes,
                    orders: w.orders,
                    total: w.total,
                    label: 'Sem ' + (idx + 1) + ' (' + startDay + '-' + endDay + ' ' + month + ')',
                    avg: w.orders > 0 ? Math.round(w.dishes / w.orders * 10) / 10 : 0,
                    activeDays: activeDays,
                    avgPerDay: avgPerDay
                };
            });
        },

        loadWeekDishData: function(startDate, endDate, allDays) {
            var self = this;
            db.ref('orders').orderByChild('date').startAt(startDate).endAt(endDate + '\uf8ff').once('value', function(s) {
                var data = s.val();
                if (data) {
                    var weekOrders = Object.values(data);
                    var dishesByDay = {};

                    weekOrders.forEach(function(o) {
                        (o.items || []).forEach(function(i) {
                            if (i.type === 'dish') {
                                dishesByDay[o.date] = (dishesByDay[o.date] || 0) + 1;
                            }
                        });
                    });

                    self.filteredStats.ordersByDay = {
                        labels: allDays.map(function(d) { return self.formatShortDate(d); }),
                        data: allDays.map(function(d) { return dishesByDay[d] || 0; })
                    };

                    if (self.view === 'stats') {
                        setTimeout(function() { self.renderCharts(); }, 100);
                    }
                }
            });
        },

        renderCharts: function() {
            try {
                if (chartDaysInstance) {
                    chartDaysInstance.destroy();
                    chartDaysInstance = null;
                }
                if (chartHoursInstance) {
                    chartHoursInstance.destroy();
                    chartHoursInstance = null;
                }

                var ctxDays = document.getElementById('chartDays');
                var ctxHours = document.getElementById('chartHours');

                if (!ctxDays || !ctxHours) {
                    console.log('Canvas no encontrados, reintentando...');
                    return;
                }

                var dayData = this.filteredStats.ordersByDay || { labels: [], data: [] };
                var hourData = this.filteredStats.ordersByHour || { labels: [], data: [] };

                chartDaysInstance = new Chart(ctxDays.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: dayData.labels || [],
                        datasets: [{
                            label: 'Platos',
                            data: dayData.data || [],
                            backgroundColor: 'rgba(59, 130, 246, 0.7)',
                            borderColor: 'rgba(59, 130, 246, 1)',
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: { duration: 300 },
                        plugins: {
                            legend: { display: false },
                            tooltip: { callbacks: { label: function(ctx) { return ctx.raw + ' platos'; } } }
                        },
                        scales: {
                            y: { beginAtZero: true, ticks: { stepSize: 1 } },
                            x: { grid: { display: false } }
                        }
                    }
                });

                chartHoursInstance = new Chart(ctxHours.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: hourData.labels || [],
                        datasets: [{
                            label: 'Platos',
                            data: hourData.data || [],
                            backgroundColor: 'rgba(234, 179, 8, 0.7)',
                            borderColor: 'rgba(234, 179, 8, 1)',
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: { duration: 300 },
                        plugins: {
                            legend: { display: false },
                            tooltip: { callbacks: { label: function(ctx) { return ctx.raw + ' platos'; } } }
                        },
                        scales: {
                            y: { beginAtZero: true, ticks: { stepSize: 1 } },
                            x: { grid: { display: false } }
                        }
                    }
                });

                this.chartsInitialized = true;
            } catch (e) {
                console.error('Error renderizando gráficos:', e);
            }
        },

        openHistoryModal: function() {
            this.historyOrders = [];
            this.historyPage = 0;
            this.loadMoreHistory();
            this.showHistoryModal = true;
        },

        loadMoreHistory: function() {
            var startIdx = this.historyPage * this.historyPageSize;
            var endIdx = startIdx + this.historyPageSize;
            var newOrders = this.filteredOrders.slice(startIdx, endIdx);
            this.historyOrders = this.historyOrders.concat(newOrders);
            this.historyPage++;
            this.hasMoreHistory = endIdx < this.filteredOrders.length;
        },

        downloadAllData: function() {
            if (this.filteredOrders.length === 0) { alert('No hay datos'); return; }

            var self = this;
            var csv = '\uFEFF' + 'ID,Fecha,Hora,Cliente,Programado,Items,Total,Estado,Pago,TiempoPrep\n';

            this.filteredOrders.forEach(function(o) {
                var itemsStr = o.items.map(function(i) { return i.title + (i.note ? ' (' + i.note + ')' : ''); }).join(' | ');
                var prepTime = o.readyTimestamp && o.timestamp ? Math.floor((o.readyTimestamp - o.timestamp) / 60000) : '';
                csv += [o.number, o.date, self.formatTime(o.timestamp), '"' + (o.customer || '') + '"', o.scheduledTime || '', '"' + itemsStr + '"', o.total, o.status, o.paymentMethod || '', prepTime].join(',') + '\n';
            });

            var link = document.createElement('a');
            link.href = encodeURI('data:text/csv;charset=utf-8,' + csv);
            link.download = 'ventas_mamma_ia_' + this.dateFrom + '.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    MammaIA.register(state, methods);
    console.log('Stats module loaded');
})();
