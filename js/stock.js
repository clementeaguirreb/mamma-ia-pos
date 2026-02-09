/**
 * MAMMA IA POS - Stock / Inventario
 */
(function() {
    var state = {
        stock: {},
        stockLocked: true,
        stockError: '',
        showQuickStockModal: false,
        quickStockTarget: null,
        quickStockAmount: 0
    };

    var methods = {
        getAvailableStock: function(pastaName, masaName) {
            if (!pastaName || !masaName) return 0;
            var key = pastaName + '_' + masaName;
            var currentStock = this.stock[key] || 0;
            var inCart = this.cart.filter(function(item) {
                return item.type === 'dish' && item.pasta === pastaName && item.masa === masaName;
            }).length;

            // Si estamos editando, sumar los items originales al stock disponible
            var originalCount = 0;
            if (this.editId && this.originalItems) {
                originalCount = this.originalItems.filter(function(item) {
                    return item.type === 'dish' && item.pasta === pastaName && item.masa === masaName;
                }).length;
            }

            return currentStock + originalCount - inCart;
        },

        canAddCurrentDish: function() {
            if (!this.sel.pasta) return false;
            if (this.sel.pasta.hasMasa && !this.sel.masa) return false;
            var masaName = this.sel.pasta.hasMasa ? this.sel.masa : 'Normal';
            return this.getAvailableStock(this.sel.pasta.name, masaName) > 0;
        },

        /**
         * Verifica si hay stock suficiente para enviar el pedido actual.
         * Setea this.stockError con mensaje descriptivo si no hay stock.
         * @returns {boolean} true si hay stock suficiente, false si no
         */
        canSubmitOrder: function() {
            this.stockError = '';
            var dishCounts = {};
            this.cart.forEach(function(item) {
                if (item.type === 'dish' && item.pasta && item.masa) {
                    var key = item.pasta + '_' + item.masa;
                    dishCounts[key] = (dishCounts[key] || 0) + 1;
                }
            });

            // Contar items originales si estamos editando
            var originalCounts = {};
            if (this.editId && this.originalItems) {
                this.originalItems.forEach(function(item) {
                    if (item.type === 'dish' && item.pasta && item.masa) {
                        var key = item.pasta + '_' + item.masa;
                        originalCounts[key] = (originalCounts[key] || 0) + 1;
                    }
                });
            }

            var self = this;
            var entries = Object.entries(dishCounts);
            for (var i = 0; i < entries.length; i++) {
                var key = entries[i][0];
                var count = entries[i][1];
                var currentStock = self.stock[key] || 0;
                var originalCount = originalCounts[key] || 0;
                var availableStock = currentStock + originalCount;

                if (count > availableStock) {
                    var parts = key.split('_');
                    self.stockError = 'Sin stock suficiente: ' + parts[0] + ' ' + parts[1] + ' (necesitas ' + count + ', disponible ' + availableStock + ')';
                    return false;
                }
            }
            return true;
        },

        getTotalStock: function(p) {
            if (!p.hasMasa) return this.stock[p.name + '_Normal'] || 0;
            var total = 0;
            var self = this;
            this.config.masas.forEach(function(m) {
                if (self.isMasaAllowed(p, m.name)) total += (self.stock[p.name + '_' + m.name] || 0);
            });
            return total;
        },

        getDetailedStock: function(p) {
            var total = this.getTotalStock(p);
            if (!p.hasMasa) return '<span class="font-bold">' + total + '</span>';
            var details = [];
            var self = this;
            this.config.masas.forEach(function(m) {
                if (self.isMasaAllowed(p, m.name)) {
                    var s = self.stock[p.name + '_' + m.name] || 0;
                    details.push('<span class="text-' + m.color + '-700 font-bold">' + s + '</span>');
                }
            });
            return '<span class="font-bold">' + total + '</span> (' + details.join('-') + ')';
        },

        getPastaStockStatus: function(pasta) {
            var total = this.getTotalStock(pasta);
            var status = 'ok';
            if (total <= 0) status = 'out';
            else if (total <= 2) status = 'critical';
            else if (total <= 5) status = 'low';
            return { status: status, total: total };
        },

        getStockRowTotal: function(p) {
            return this.getTotalStock(p);
        },

        getStockColTotal: function(masaName) {
            var total = 0;
            var self = this;
            this.config.pastas.forEach(function(p) {
                if (masaName === 'Normal') {
                    if (!p.hasMasa) total += (self.stock[p.name + '_Normal'] || 0);
                } else {
                    if (p.hasMasa && self.isMasaAllowed(p, masaName)) total += (self.stock[p.name + '_' + masaName] || 0);
                }
            });
            return total;
        },

        updateStock: function(p, m, val) {
            if (this.stockLocked) return;
            db.ref('stock/' + p + '_' + m).transaction(function(curr) {
                var n = (curr || 0) + val;
                return n < 0 ? 0 : n;
            });
        },

        updateStockBy: function(pasta, masa, amount) {
            if (this.stockLocked) return;
            db.ref('stock/' + pasta + '_' + masa).transaction(function(curr) {
                var n = (curr || 0) + amount;
                return n < 0 ? 0 : n;
            });
        },

        openQuickStockModal: function(pasta, masa) {
            if (this.stockLocked) return;
            this.quickStockTarget = { pasta: pasta, masa: masa };
            this.quickStockAmount = 0;
            this.showQuickStockModal = true;
        },

        confirmQuickStock: function() {
            if (!this.quickStockTarget || this.quickStockAmount <= 0) return;
            this.updateStockBy(this.quickStockTarget.pasta, this.quickStockTarget.masa, this.quickStockAmount);
            this.notify('success', '+' + this.quickStockAmount + ' ' + this.quickStockTarget.pasta + ' ' + this.quickStockTarget.masa);
            this.showQuickStockModal = false;
            this.quickStockTarget = null;
            this.quickStockAmount = 0;
        },

        getTrackedExtras: function() {
            var tracked = [];
            (this.config.extras || []).forEach(function(extra) {
                // Extras SIN variantes con trackStock
                if ((!extra.variants || extra.variants.length === 0) && extra.trackStock === true) {
                    tracked.push({
                        key: extra.name,
                        label: extra.name,
                        extraName: extra.name,
                        variantName: null
                    });
                }
                // Extras CON variantes
                (extra.variants || []).forEach(function(variant) {
                    if (variant.trackStock) {
                        tracked.push({
                            key: extra.name + '_' + variant.name,
                            label: extra.name + ' - ' + variant.name,
                            extraName: extra.name,
                            variantName: variant.name
                        });
                    }
                });
            });
            return tracked;
        },

        updateExtraStock: function(key, val) {
            if (this.stockLocked) return;
            db.ref('stock/extra_' + key).transaction(function(curr) {
                var n = (curr || 0) + val;
                return n < 0 ? 0 : n;
            });
        },

        getExtraStock: function(extraName, variantName) {
            var key = 'extra_' + extraName + '_' + variantName;
            return this.stock[key] || 0;
        },

        isExtraInStock: function(extraName, variantName) {
            var extra = (this.config.extras || []).find(function(e) { return e.name === extraName; });
            if (!extra) return true;

            // Extra SIN variantes
            if (!variantName) {
                if (extra.trackStock !== true) return true;
                var stock = this.stock['extra_' + extraName] || 0;
                return stock > 0;
            }

            // Extra CON variantes
            var variant = (extra.variants || []).find(function(v) { return v.name === variantName; });
            if (!variant || !variant.trackStock) return true;

            var stockVal = this.stock['extra_' + extraName + '_' + variantName] || 0;
            return stockVal > 0;
        },

        getExtraStockCount: function(extraName, variantName) {
            if (variantName) {
                return this.stock['extra_' + extraName + '_' + variantName] || 0;
            }
            return this.stock['extra_' + extraName] || 0;
        },

        /**
         * Procesa transacción de stock para items de un pedido.
         * @param {Array} items - Items del pedido (dishes y extras)
         * @param {number} direction - 1 para devolver stock, -1 para descontar
         */
        handleStockTransaction: function(items, direction) {
            var self = this;
            items.forEach(function(i) {
                if (i.type === 'dish' && i.pasta && i.masa) {
                    var key = 'stock/' + i.pasta + '_' + i.masa;
                    db.ref(key).transaction(function(curr) {
                        var val = (curr || 0) + direction;
                        return val < 0 ? 0 : val;
                    });
                }
                // Manejar stock de extras
                if (i.type === 'extra' && i.extraName) {
                    var extra = (self.config.extras || []).find(function(e) { return e.name === i.extraName; });
                    if (extra) {
                        // Extra SIN variantes
                        if (!i.variantName && extra.trackStock === true) {
                            var keyExtra = 'stock/extra_' + i.extraName;
                            db.ref(keyExtra).transaction(function(curr) {
                                var val = (curr || 0) + direction;
                                return val < 0 ? 0 : val;
                            });
                        }
                        // Extra CON variantes
                        if (i.variantName) {
                            var variant = (extra.variants || []).find(function(v) { return v.name === i.variantName; });
                            if (variant && variant.trackStock) {
                                var keyVariant = 'stock/extra_' + i.extraName + '_' + i.variantName;
                                db.ref(keyVariant).transaction(function(curr) {
                                    var val = (curr || 0) + direction;
                                    return val < 0 ? 0 : val;
                                });
                            }
                        }
                    }
                }
            });
        }
    };

    MammaIA.register(state, methods);
    console.log('Stock module loaded');
})();
