/**
 * MAMMA IA POS - Carrito
 */
(function() {
    var state = {
        cart: [],
        sel: { pasta: null, masa: null },
        customer: '',
        scheduledTime: '',
        showVariantModal: false,
        tempExtra: null,
        showSplitModal: false,
        splitAssignments: []
    };

    var methods = {
        selectPasta: function(p) {
            this.sel.pasta = p;
            this.sel.masa = null;
            this.stockError = '';
        },

        isMasaAllowed: function(pasta, masaName) {
            if (!pasta) return false;
            if (!pasta.hasMasa) return false;
            if (!pasta.allowed) return true;
            return pasta.allowed.includes(masaName);
        },

        selectMasa: function(m) {
            var available = this.getAvailableStock(this.sel.pasta.name, m);
            if (available <= 0) {
                this.notify('error', 'Sin Stock disponible');
                return;
            }
            this.sel.masa = m;
        },

        addDish: function(s) {
            if (s.disabled) {
                this.notify('error', 'Salsa no disponible');
                return;
            }

            if (!this.sel.pasta) {
                this.notify('error', 'Selecciona una pasta primero');
                return;
            }

            var masaFinal = this.sel.masa;

            if (this.sel.pasta.hasMasa) {
                if (!this.sel.masa) {
                    this.notify('error', 'Selecciona una masa primero');
                    return;
                }
                if (this.getAvailableStock(this.sel.pasta.name, this.sel.masa) <= 0) {
                    this.notify('error', 'Sin stock disponible');
                    return;
                }
            } else {
                if (this.getAvailableStock(this.sel.pasta.name, 'Normal') <= 0) {
                    this.notify('error', 'Sin Stock');
                    return;
                }
                masaFinal = '';
            }

            var title = (this.sel.pasta.name + ' ' + masaFinal + ' ' + s.name).replace('  ', ' ');
            var delta = this.sel.pasta.priceDelta || 0;
            this.cart.push({
                type: 'dish',
                title: title,
                detail: '',
                price: s.price + delta,
                pasta: this.sel.pasta.name,
                masa: this.sel.pasta.hasMasa ? masaFinal : 'Normal',
                salsa: s.name,
                note: ''
            });
            this.sel = { pasta: null, masa: null };
            this.stockError = '';
        },

        removeFromCart: function(idx) {
            this.cart.splice(idx, 1);
            this.stockError = '';
            this.canSubmitOrder();
        },

        handleExtraClick: function(e) {
            if (e.disabled) { this.notify('error', 'Extra no disponible'); return; }
            if (e.variants && e.variants.length > 0) {
                this.tempExtra = e;
                this.showVariantModal = true;
            } else {
                if (e.trackStock === true && !this.isExtraInStock(e.name, null)) {
                    this.notify('error', 'Sin stock disponible');
                    return;
                }
                this.addExtra(e);
            }
        },

        selectVariant: function(v) {
            if (v.disabled) { this.notify('error', 'Opción no disponible'); return; }
            this.addExtra(this.tempExtra, v);
            this.showVariantModal = false;
            this.tempExtra = null;
        },

        addExtra: function(e, variant) {
            var title = variant ? e.name + ' (' + variant.name + ')' : e.name;
            var price = variant ? variant.price : (e.price || 0);

            var item = {
                type: 'extra',
                title: title,
                detail: '',
                price: price,
                note: '',
                extraName: e.name,
                variantName: variant ? variant.name : null
            };

            this.cart.push(item);
            this.notify('success', title + ' agregado');
        },

        getExtraPriceDisplay: function(e) {
            if (e.variants && e.variants.length > 0) {
                var activeVariants = e.variants.filter(function(v) { return !v.disabled; });
                if (activeVariants.length === 0) return 'AGOTADO';
                var prices = activeVariants.map(function(v) { return v.price; });
                var min = Math.min.apply(null, prices);
                var max = Math.max.apply(null, prices);
                return min === max ? this.formatPrice(min) : this.formatPrice(min) + '+';
            }
            return this.formatPrice(e.price || 0);
        },

        cancelOrder: function() {
            this.cart = [];
            this.customer = '';
            this.sel = { pasta: null, masa: null };
            this.scheduledTime = '';
            this.editId = null;
            this.editingTime = '';
            this.originalItems = null;
            this.stockError = '';
        },

        openSplitModal: function() {
            if (this.cart.length < 2) {
                this.notify('error', 'Se necesitan al menos 2 items para dividir');
                return;
            }
            this.splitAssignments = this.cart.map(function() { return 1; });
            this.showSplitModal = true;
        },

        assignToAccount: function(itemIdx, accountNum) {
            this.splitAssignments[itemIdx] = accountNum;
        },

        getAccountTotals: function() {
            var self = this;
            var totals = { 1: 0, 2: 0, 3: 0, 4: 0 };
            this.cart.forEach(function(item, idx) {
                var account = self.splitAssignments[idx] || 1;
                totals[account] += item.price;
            });
            return totals;
        },

        getAccountItems: function(accountNum) {
            var self = this;
            var items = [];
            this.cart.forEach(function(item, idx) {
                if (self.splitAssignments[idx] === accountNum) {
                    items.push(item);
                }
            });
            return items;
        },

        getUsedAccounts: function() {
            var used = {};
            var self = this;
            this.splitAssignments.forEach(function(acc) {
                used[acc] = true;
            });
            return Object.keys(used).map(Number).sort();
        },

        submitSplitOrders: function() {
            var self = this;
            var usedAccounts = this.getUsedAccounts();

            if (usedAccounts.length < 2) {
                this.notify('error', 'Asigna items a al menos 2 cuentas diferentes');
                return;
            }

            var splitGroup = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            var baseNumber = this.getNextOrderNumber();
            var splitLabels = ['A', 'B', 'C', 'D'];
            var splitTotal = this.cartTotal;
            var promises = [];

            usedAccounts.forEach(function(accountNum, idx) {
                var items = self.getAccountItems(accountNum);
                if (items.length === 0) return;

                var total = items.reduce(function(sum, item) { return sum + item.price; }, 0);
                var orderData = {
                    number: baseNumber,
                    date: self.getLocalToday(),
                    timestamp: Date.now(),
                    customer: self.customer,
                    scheduledTime: self.scheduledTime || null,
                    items: items,
                    total: total,
                    status: 'Pendiente',
                    paymentMethod: null,
                    splitIndex: idx,
                    splitGroup: splitGroup,
                    splitTotal: splitTotal
                };

                var orderRef = db.ref('orders').push();
                orderData.id = orderRef.key;

                self.handleStockTransaction(null, items);
                promises.push(orderRef.set(orderData));
            });

            Promise.all(promises).then(function() {
                self.notify('success', 'Cuenta dividida en ' + usedAccounts.length + ' pedidos');
                self.showSplitModal = false;
                self.cancelOrder();
                self.cartDrawerOpen = false;
            }).catch(function(err) {
                self.notify('error', 'Error al dividir cuenta');
                console.error(err);
            });
        },

        getOrderDisplayNumber: function(order) {
            var splitLabels = ['A', 'B', 'C', 'D'];
            if (order.splitIndex !== undefined && order.splitIndex !== null) {
                return '#' + order.number + '-' + splitLabels[order.splitIndex];
            }
            return '#' + order.number;
        }
    };

    MammaIA.register(state, methods);
    console.log('Cart module loaded');
})();
