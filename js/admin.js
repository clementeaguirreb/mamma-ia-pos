/**
 * MAMMA IA POS - Admin / Configuracion del menu
 */
(function() {
    var state = {
        adminLocked: true
    };

    var methods = {
        normalizeConfig: function() {
            var self = this;
            this.config.extras.forEach(function(e) {
                if (!e.variants) e.variants = [];
                if (e.disabled === undefined) e.disabled = false;
                if (e.price === undefined) e.price = 0;
                e.variants.forEach(function(v) {
                    if (v.disabled === undefined) v.disabled = false;
                    if (v.price === undefined) v.price = 0;
                });
            });
            this.config.pastas.forEach(function(p) {
                if (p.hasMasa && !p.allowed) p.allowed = self.config.masas.map(function(m) { return m.name; });
                if (p.priceDelta === undefined) p.priceDelta = 0;
            });
            this.config.salsas.forEach(function(s) {
                if (s.disabled === undefined) s.disabled = false;
                if (s.price === undefined) s.price = 0;
            });
        },

        addItem: function(type) {
            if (this.adminLocked) return;
            if (type === 'pastas') this.config.pastas.push({ name: 'Nueva', hasMasa: true, allowed: this.config.masas.map(function(m) { return m.name; }) });
            if (type === 'salsas') this.config.salsas.push({ name: 'Nueva', cat: 'roja', price: 0, disabled: false });
            if (type === 'extras') this.config.extras.push({ name: 'Nuevo', price: 0, disabled: false, variants: [] });
            this.saveConfig();
        },

        removeItem: function(type, idx) {
            if (this.adminLocked) return;
            if (confirm('¿Borrar?')) { this.config[type].splice(idx, 1); this.saveConfig(); }
        },

        toggleAllowedMasa: function(pastaIndex, masaName) {
            if (this.adminLocked) return;
            var p = this.config.pastas[pastaIndex];
            if (!p.allowed) p.allowed = [];
            var idx = p.allowed.indexOf(masaName);
            if (idx === -1) p.allowed.push(masaName);
            else p.allowed.splice(idx, 1);
            this.saveConfig();
        },

        addVariant: function(extraIndex) {
            if (this.adminLocked) return;
            var e = this.config.extras[extraIndex];
            if (!e.variants) e.variants = [];
            e.variants.push({ name: 'Nueva', price: 0, disabled: false });
            this.saveConfig();
        },

        removeVariant: function(extraIndex, variantIndex) {
            if (this.adminLocked) return;
            if (confirm('¿Borrar opción?')) { this.config.extras[extraIndex].variants.splice(variantIndex, 1); this.saveConfig(); }
        },

        saveConfig: debounce(function() {
            var self = this;
            db.ref('config').set(this.config)
                .catch(function(err) {
                    console.error('[Admin] Error guardando config:', err);
                    self.notify('error', 'Error al guardar configuración');
                });
        }, 500)
    };

    MammaIA.register(state, methods);
    console.log('Admin module loaded');
})();
