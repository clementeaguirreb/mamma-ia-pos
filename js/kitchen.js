/**
 * MAMMA IA POS - Cocina
 */
(function() {
    var state = {
        showReadyColumn: false,
        showPaymentModal: false,
        showReadyTimeModal: false,
        tempOrderForPayment: null,
        tempOrderForReady: null,
        customReadyTime: '',
        kitchenExtraOrder: null,
        showKitchenExtrasModal: false,
        scheduledCollapsed: localStorage.getItem('scheduledCollapsed') === 'true',
        soundEnabled: localStorage.getItem('kitchenSoundEnabled') !== 'false',
        lastKnownOrderIds: [],
        initialLoadComplete: false,
        kitchenSimpleMode: localStorage.getItem('kitchenSimpleMode') === 'true',
        simpleModeClock: ''
    };

    var methods = {
        toggleScheduledCollapsed: function() {
            this.scheduledCollapsed = !this.scheduledCollapsed;
            localStorage.setItem('scheduledCollapsed', this.scheduledCollapsed);
        },

        getScheduledPreview: function() {
            return this.getScheduledOrders().slice(0, 3);
        },

        shouldAutoCollapse: function() {
            return this.getScheduledOrders().length >= 4;
        },

        toggleSound: function() {
            this.soundEnabled = !this.soundEnabled;
            localStorage.setItem('kitchenSoundEnabled', this.soundEnabled);
            if (this.soundEnabled) {
                this.playNotificationSound();
            }
        },

        playNotificationSound: function() {
            try {
                var audioContext = new (window.AudioContext || window.webkitAudioContext)();
                var oscillator = audioContext.createOscillator();
                var gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 800;
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            } catch (e) {
                console.log('Audio not available:', e);
            }
        },

        checkForNewOrders: function(newOrders) {
            if (!this.initialLoadComplete) {
                this.lastKnownOrderIds = newOrders.map(function(o) { return o.id; });
                this.initialLoadComplete = true;
                return;
            }

            if (!this.soundEnabled) return;

            var self = this;
            var newIds = newOrders.map(function(o) { return o.id; });
            var hasNewOrder = newIds.some(function(id) {
                return self.lastKnownOrderIds.indexOf(id) === -1;
            });

            if (hasNewOrder) {
                this.playNotificationSound();
            }

            this.lastKnownOrderIds = newIds;
        },

        getScheduledWaitDisplay: function(order) {
            if (!order.scheduledTime || !order.timestamp) {
                return { label: 'Espera: ', time: this.getWaitTimeDisplay(order.timestamp), class: 'text-gray-700' };
            }

            var now = new Date();
            var parts = order.scheduledTime.split(':').map(Number);
            var scheduled = new Date();
            scheduled.setHours(parts[0], parts[1], 0, 0);

            var diffMs = now - scheduled;
            var diffMins = Math.floor(diffMs / 60000);

            if (diffMins < -5) {
                return { label: 'Faltan: ', time: Math.abs(diffMins) + ' min', class: 'text-blue-600' };
            } else if (diffMins >= -5 && diffMins <= 5) {
                return { label: 'Estado: ', time: 'A tiempo', class: 'text-green-600' };
            } else {
                return { label: 'Atraso: ', time: diffMins + ' min', class: 'text-red-500' };
            }
        },

        getCompletionTime: function(order) {
            if (!order.readyTimestamp) return '-';

            var referenceTime;

            if (order.scheduledTime && order.date) {
                var parts = order.scheduledTime.split(':').map(Number);
                var scheduledDate = new Date(order.date + 'T12:00:00');
                scheduledDate.setHours(parts[0], parts[1], 0, 0);
                referenceTime = scheduledDate.getTime();
            } else {
                if (!order.timestamp) return '-';
                referenceTime = order.timestamp;
            }

            var diff = order.readyTimestamp - referenceTime;
            var mins = Math.floor(diff / 60000);

            if (order.scheduledTime) {
                return mins;
            }

            if (diff < 0) return '-';
            return mins;
        },

        formatCompletionTime: function(order) {
            var mins = this.getCompletionTime(order);
            if (mins === '-') return '-';

            if (order.scheduledTime) {
                if (mins <= 0) return Math.abs(mins) + ' min';
                return '+' + mins + ' min';
            }

            return mins + ' min';
        },

        getOrderCardClasses: function(order) {
            // Pedido listo
            if (order.status === 'Listo') {
                return 'bg-green-50 border-l-4 border-green-500';
            }

            // Pedido programado
            if (order.scheduledTime) {
                var now = new Date();
                var parts = order.scheduledTime.split(':').map(Number);
                var scheduled = new Date();
                scheduled.setHours(parts[0], parts[1], 0, 0);
                var diffMins = Math.floor((now - scheduled) / 60000);

                // Programado atrasado (más de 5 min después de la hora)
                if (diffMins > 5) {
                    return 'bg-red-50 border-l-4 border-red-400';
                }
                return 'bg-blue-50 border-l-4 border-blue-400';
            }

            // Pedido pendiente normal
            var waitTime = this.getWaitTime(order.timestamp);
            if (waitTime > 20) {
                return 'bg-red-50 border-l-4 border-red-400';
            }
            return 'bg-amber-50 border-l-4 border-amber-400';
        },

        getMasaColor: function(masaName) {
            var colors = {
                'Huevo': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-400' },
                'Espinaca': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500' },
                'Betarraga': { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-400' },
                'Normal': { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' }
            };
            return colors[masaName] || colors['Normal'];
        },

        getSalsaColor: function(salsaName) {
            var salsa = (this.config.salsas || []).find(function(s) { return s.name === salsaName; });
            if (!salsa) return { bg: 'bg-gray-100', text: 'text-gray-700' };

            var catColors = {
                'roja': { bg: 'bg-red-100', text: 'text-red-700' },
                'alfredo': { bg: 'bg-slate-100', text: 'text-slate-700' },
                'carne': { bg: 'bg-orange-100', text: 'text-orange-800' },
                'especial': { bg: 'bg-purple-100', text: 'text-purple-700' }
            };
            return catColors[salsa.cat] || { bg: 'bg-gray-100', text: 'text-gray-700' };
        },

        getItemClasses: function(item) {
            if (item.type !== 'dish') {
                return 'bg-blue-50 text-blue-700 border-l-2 border-blue-300';
            }
            var masaColor = this.getMasaColor(item.masa);
            return masaColor.bg + ' ' + masaColor.text + ' ' + masaColor.border + ' border-l-4';
        },

        updateStatus: function(id, s) {
            var updates = { status: s };
            if (s === 'Listo') updates.readyTimestamp = firebase.database.ServerValue.TIMESTAMP;
            db.ref('orders/' + id).update(updates);
        },

        markReady: function(id) {
            db.ref('orders/' + id).update({
                status: 'Listo',
                readyTimestamp: firebase.database.ServerValue.TIMESTAMP
            });
            this.notify('success', 'Pedido listo');
        },

        openReadyTimeModal: function(order) {
            this.tempOrderForReady = order;
            var now = new Date();
            this.customReadyTime = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
            this.showReadyTimeModal = true;
        },

        editReadyTime: function(order) {
            this.tempOrderForReady = order;
            if (order.readyTimestamp) {
                var readyDate = new Date(order.readyTimestamp);
                this.customReadyTime = String(readyDate.getHours()).padStart(2,'0') + ':' + String(readyDate.getMinutes()).padStart(2,'0');
            } else {
                var now = new Date();
                this.customReadyTime = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
            }
            this.showReadyTimeModal = true;
        },

        confirmReadyWithTime: function() {
            if (!this.tempOrderForReady || !this.customReadyTime) return;
            var order = this.tempOrderForReady;
            var datePart = order.date;
            var readyDate = new Date(datePart + 'T' + this.customReadyTime);

            if (!isNaN(readyDate.getTime())) {
                db.ref('orders/' + order.id).update({ status: 'Listo', readyTimestamp: readyDate.getTime() });
                this.notify('success', 'Hora actualizada');
            }

            this.showReadyTimeModal = false;
            this.tempOrderForReady = null;
            this.customReadyTime = '';
        },

        openPaymentModal: function(order) {
            this.tempOrderForPayment = order;
            this.showPaymentModal = true;
        },

        setPaymentMethod: function(method) {
            if (!this.tempOrderForPayment) return;
            db.ref('orders/' + this.tempOrderForPayment.id + '/paymentMethod').set(method);
            this.showPaymentModal = false;
            this.tempOrderForPayment = null;
            this.notify('success', 'Pago: ' + method);
        },

        openKitchenExtrasModal: function(order) {
            this.kitchenExtraOrder = order;
            this.showKitchenExtrasModal = true;
        },

        handleKitchenExtraClick: function(e) {
            if (e.disabled) {
                this.notify('error', 'Extra no disponible');
                return;
            }
            if (e.variants && e.variants.length > 0) {
                this.showKitchenExtrasModal = false;
                this.tempExtra = e;
                this.showVariantModal = true;
            } else {
                if (e.trackStock === true && !this.isExtraInStock(e.name, null)) {
                    this.notify('error', 'Sin stock disponible');
                    return;
                }
                this.addExtraToKitchenOrder(e);
            }
        },

        selectKitchenVariant: function(v) {
            if (v.disabled) {
                this.notify('error', 'Opción no disponible');
                return;
            }
            if (v.trackStock === true) {
                var stockKey = 'extra_' + this.tempExtra.name + '_' + v.name;
                if ((this.stock[stockKey] || 0) <= 0) {
                    this.notify('error', 'Sin stock disponible');
                    return;
                }
            }
            this.addExtraToKitchenOrder(this.tempExtra, v);
            this.showVariantModal = false;
            this.tempExtra = null;
        },

        addExtraToKitchenOrder: function(e, variant) {
            if (!this.kitchenExtraOrder) return;

            var title = variant ? e.name + ' (' + variant.name + ')' : e.name;
            var price = variant ? variant.price : (e.price || 0);

            var newItem = {
                type: 'extra',
                title: title,
                detail: '',
                price: price,
                note: '',
                extraName: e.name,
                variantName: variant ? variant.name : null
            };

            var updatedItems = this.kitchenExtraOrder.items.concat([newItem]);
            var newTotal = this.kitchenExtraOrder.total + price;

            var self = this;
            var orderNumber = this.kitchenExtraOrder.number;
            db.ref('orders/' + this.kitchenExtraOrder.id).update({
                items: updatedItems,
                total: newTotal
            }).catch(function(err) {
                console.error('[Kitchen] Error agregando extra:', err);
                self.notify('error', 'Error al agregar extra');
            });

            this.handleStockTransaction([newItem], -1);

            this.notify('success', title + ' agregado a #' + orderNumber);
            this.showKitchenExtrasModal = false;
            this.kitchenExtraOrder = null;
        },

        // ========== MODO SIMPLIFICADO ==========
        toggleKitchenMode: function() {
            this.kitchenSimpleMode = !this.kitchenSimpleMode;
            localStorage.setItem('kitchenSimpleMode', this.kitchenSimpleMode);
            if (this.kitchenSimpleMode) {
                this.startSimpleClock();
                this.initSimpleKeyboardShortcuts();
            } else {
                this.stopSimpleClock();
                this.removeSimpleKeyboardShortcuts();
            }
        },

        startSimpleClock: function() {
            var self = this;
            this.updateSimpleClock();
            this._clockInterval = setInterval(function() {
                self.updateSimpleClock();
            }, 1000);
        },

        stopSimpleClock: function() {
            if (this._clockInterval) {
                clearInterval(this._clockInterval);
                this._clockInterval = null;
            }
        },

        updateSimpleClock: function() {
            var now = new Date();
            this.simpleModeClock = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        },

        initSimpleKeyboardShortcuts: function() {
            var self = this;
            this._simpleKeyHandler = function(e) {
                if (!self.kitchenSimpleMode || self.view !== 'kitchen') return;
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

                var key = parseInt(e.key);
                if (key >= 1 && key <= 9) {
                    var allOrders = self.getSimpleModeOrders();
                    var index = key - 1;
                    if (allOrders[index]) {
                        self.markReady(allOrders[index].id);
                    }
                }
            };
            document.addEventListener('keydown', this._simpleKeyHandler);
        },

        removeSimpleKeyboardShortcuts: function() {
            if (this._simpleKeyHandler) {
                document.removeEventListener('keydown', this._simpleKeyHandler);
                this._simpleKeyHandler = null;
            }
        },

        getSimpleModeOrders: function() {
            return this.getPendingOrders().concat(this.getScheduledOrders());
        },

        getSimpleOrderStatus: function(order) {
            if (order.scheduledTime) {
                return 'scheduled';
            }
            var waitTime = this.getWaitTime(order.timestamp);
            return waitTime > 15 ? 'urgent' : 'normal';
        },

        getSimpleHeaderClasses: function(order) {
            var status = this.getSimpleOrderStatus(order);
            if (status === 'scheduled') {
                return 'bg-gradient-to-r from-blue-500 to-blue-600 ring-4 ring-blue-400';
            }
            if (status === 'urgent') {
                return 'bg-gradient-to-r from-red-500 to-red-600';
            }
            return 'bg-gradient-to-r from-amber-400 to-amber-500';
        },

        getSimpleCardClasses: function(order) {
            var status = this.getSimpleOrderStatus(order);
            if (status === 'urgent') {
                return 'urgent';
            }
            return '';
        },

        getSimpleWaitDisplay: function(order) {
            if (order.scheduledTime) {
                var now = new Date();
                var parts = order.scheduledTime.split(':').map(Number);
                var scheduled = new Date();
                scheduled.setHours(parts[0], parts[1], 0, 0);
                var diffMins = Math.floor((scheduled - now) / 60000);

                if (diffMins > 0) {
                    return 'Faltan ' + diffMins + ' min';
                } else if (diffMins < 0) {
                    return 'Hace ' + Math.abs(diffMins) + ' min';
                }
                return 'Ahora';
            }
            return this.getWaitTimeDisplay(order.timestamp);
        },

        getSimpleMasaClasses: function(masa) {
            var classes = {
                'Huevo': { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700' },
                'Espinaca': { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700' },
                'Betarraga': { bg: 'bg-pink-50', border: 'border-pink-400', text: 'text-pink-700' },
                'Normal': { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700' }
            };
            return classes[masa] || classes['Normal'];
        },

        getSimpleSalsaColor: function(salsaName) {
            var salsa = (this.config.salsas || []).find(function(s) { return s.name === salsaName; });
            if (!salsa) return 'text-gray-600';

            var colors = {
                'roja': 'text-red-600',
                'alfredo': 'text-slate-600',
                'carne': 'text-orange-600',
                'especial': 'text-purple-600'
            };
            return colors[salsa.cat] || 'text-gray-600';
        },

        getTodayDeliveredCount: function() {
            var today = this.getLocalToday();
            return this.orders
                .filter(function(o) {
                    return o.date === today && (o.status === 'Listo' || o.status === 'Entregado');
                })
                .reduce(function(count, order) {
                    return count + (order.items || []).filter(function(i) { return i.type === 'dish'; }).length;
                }, 0);
        },

        initKitchenSimpleMode: function() {
            if (this.kitchenSimpleMode) {
                this.startSimpleClock();
                this.initSimpleKeyboardShortcuts();
            }
        }
    };

    MammaIA.register(state, methods);
    console.log('Kitchen module loaded');
})();
