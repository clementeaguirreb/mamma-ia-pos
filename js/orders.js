/**
 * MAMMA IA POS - Pedidos
 */
(function() {
    var state = {
        orders: [],
        editId: null,
        editNum: null,
        originalItems: null,
        editingTime: '',
        ordersListener: null
    };

    var methods = {
        /**
         * Configura listeners en tiempo real de Firebase para config, orders, stock y conexión.
         * Se ejecuta después de autenticación exitosa.
         */
        setupListeners: function() {
            var self = this;

            db.ref('config').on('value', function(s) {
                var data = s.val();
                if (data) {
                    self.config = Object.assign({}, self.defaultConfig, data);
                    self.normalizeConfig();
                } else {
                    self.config = JSON.parse(JSON.stringify(self.defaultConfig));
                    db.ref('config').set(self.config);
                }
                self.calculateStats();
            });

            this.loadTodayOrders();

            db.ref('stock').on('value', function(s) {
                self.stock = s.val() || {};
            });

            db.ref('.info/connected').on('value', function(s) {
                self.online = s.val();
            });

            this.$watch('dateFrom', function() {
                if (!self.isRangeMode) self.dateTo = self.dateFrom;
                self.loadOrdersForRange();
            });
            this.$watch('dateTo', function() { self.loadOrdersForRange(); });
            this.$watch('comboLimit', function() { self.calculateStats(); });
        },

        loadTodayOrders: function() {
            var today = this.getLocalToday();
            var self = this;
            if (this.ordersListener) db.ref('orders').off('value', this.ordersListener);

            this.ordersListener = db.ref('orders').orderByChild('date').equalTo(today).on('value', function(s) {
                var data = s.val();
                var newOrders = data ? Object.values(data).sort(function(a, b) { return b.timestamp - a.timestamp; }) : [];
                self.checkForNewOrders(newOrders);
                self.orders = newOrders;
                self.loading = false;
                self.calculateStats();
            });
        },

        loadOrdersForRange: function() {
            var self = this;
            if (this.ordersListener) db.ref('orders').off('value', this.ordersListener);

            if (this.dateFrom === this.getLocalToday() && !this.isRangeMode) {
                this.loadTodayOrders();
                return;
            }

            db.ref('orders').orderByChild('date').startAt(this.dateFrom).endAt(this.dateTo + '\uf8ff').once('value', function(s) {
                var data = s.val();
                self.orders = data ? Object.values(data).sort(function(a, b) { return b.timestamp - a.timestamp; }) : [];
                self.calculateStats();
            });
        },

        /**
         * Envía el pedido actual a Firebase. Crea nuevo pedido o actualiza existente si editId está seteado.
         * Valida stock antes de procesar y maneja transacciones de inventario.
         */
        submitOrder: function() {
            if (!this.canSubmitOrder()) {
                this.notify('error', this.stockError || 'Error de stock');
                return;
            }

            var todayStr = this.getLocalToday();
            var self = this;

            if (this.editId) {
                if (this.originalItems) {
                    this.handleStockTransaction(this.originalItems, 1);
                }

                var updateData = {
                    customer: this.customer,
                    scheduledTime: this.scheduledTime && this.scheduledTime.trim() !== '' ? this.scheduledTime : null,
                    items: this.cart,
                    total: this.cartTotal
                };

                db.ref('orders/' + this.editId).update(updateData)
                    .catch(function(err) {
                        console.error('[Orders] Error actualizando pedido:', err);
                        self.notify('error', 'Error al actualizar pedido');
                    });
                this.handleStockTransaction(this.cart, -1);
                this.notify('success', 'Pedido Actualizado');

                this.cancelOrder();
                if (this.userRole === 'admin') {
                    this.view = 'kitchen';
                }
            } else {
                // Calcular numero basado en pedidos existentes del dia
                var daily = this.orders.filter(function(o) { return o.date === todayStr; });
                var maxNum = daily.length > 0 ? Math.max.apply(null, daily.map(function(o) { return o.number || 0; })) : 0;
                var num = maxNum + 1;

                var newRef = db.ref('orders').push();
                var order = {
                    id: newRef.key,
                    number: num,
                    date: todayStr,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    customer: this.customer,
                    scheduledTime: this.scheduledTime && this.scheduledTime.trim() !== '' ? this.scheduledTime : null,
                    items: JSON.parse(JSON.stringify(this.cart)),
                    total: this.cartTotal,
                    status: 'Pendiente',
                    paymentMethod: null
                };

                newRef.set(order).then(function() {
                    self.handleStockTransaction(self.cart, -1);
                    self.notify('success', 'Pedido #' + num + ' creado');

                    self.cancelOrder();
                    if (self.userRole === 'admin') {
                        self.view = 'kitchen';
                    }
                }).catch(function(err) {
                    console.error('[Order] Error guardando:', err);
                    self.notify('error', 'Error al guardar pedido');
                });
            }
        },

        editOrder: function(o) {
            if (!confirm('¿Editar pedido?')) return;
            this.cart = JSON.parse(JSON.stringify(o.items));
            this.customer = o.customer;
            this.scheduledTime = o.scheduledTime || '';
            this.editId = o.id;
            this.editNum = o.number;
            this.originalItems = JSON.parse(JSON.stringify(o.items));

            var d = new Date(o.timestamp);
            this.editingTime = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');

            this.view = 'pos';
        },

        deleteOrder: function(o) {
            if (!confirm('¿Eliminar? Se devolverá el stock.')) return;
            this.handleStockTransaction(o.items, 1);
            db.ref('orders/' + o.id).remove();
            this.notify('success', 'Eliminado');
        },

        getOrders: function(status) {
            if (status === 'Pendiente') return this.orders.filter(function(o) { return o.status === status; }).sort(function(a, b) { return a.timestamp - b.timestamp; });
            var self = this;
            return this.orders.filter(function(o) { return o.status === status && self.isToday(o.timestamp); });
        },

        getPendingOrders: function() {
            return this.orders
                .filter(function(o) { return o.status === 'Pendiente' && !o.scheduledTime; })
                .sort(function(a, b) {
                    // Ordenar por priority si existe, sino por número
                    var priorityA = a.priority !== undefined ? a.priority : 999999;
                    var priorityB = b.priority !== undefined ? b.priority : 999999;
                    if (priorityA !== priorityB) return priorityA - priorityB;
                    return (a.number || 0) - (b.number || 0);
                });
        },

        initSortable: function() {
            var self = this;
            var container = document.getElementById('pending-orders-container');
            if (!container || container._sortable) return;

            container._sortable = new Sortable(container, {
                animation: 150,
                handle: '.drag-handle',
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                onEnd: function(evt) {
                    self.updateOrderPriorities();
                }
            });
        },

        updateOrderPriorities: function() {
            var container = document.getElementById('pending-orders-container');
            if (!container) return;

            var orderCards = container.querySelectorAll('[data-order-id]');
            var updates = {};

            orderCards.forEach(function(card, index) {
                var orderId = card.getAttribute('data-order-id');
                if (orderId) {
                    updates['orders/' + orderId + '/priority'] = index;
                }
            });

            if (Object.keys(updates).length > 0) {
                db.ref().update(updates);
            }
        },

        getScheduledOrders: function() {
            return this.orders
                .filter(function(o) { return o.status === 'Pendiente' && o.scheduledTime; })
                .sort(function(a, b) {
                    var timeA = a.scheduledTime || '99:99';
                    var timeB = b.scheduledTime || '99:99';
                    return timeA.localeCompare(timeB);
                });
        },

        hasScheduledOrders: function() {
            return this.orders.some(function(o) { return o.status === 'Pendiente' && o.scheduledTime; });
        },

        getDishes: function(order) {
            return (order.items || []).filter(function(i) { return i.type === 'dish'; });
        },

        getExtrasText: function(order) {
            var extras = (order.items || []).filter(function(i) { return i.type !== 'dish'; });
            if (extras.length === 0) return '';
            return extras.map(function(e) { return e.title + (e.note ? ' (' + e.note + ')' : ''); }).join(', ');
        }
    };

    MammaIA.register(state, methods);
    console.log('Orders module loaded');
})();
