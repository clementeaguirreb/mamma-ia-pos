/**
 * MAMMA IA POS - Utilidades
 */
(function() {
    var CONSTANTS = {
        SESSION_MAX_AGE_MS: 24 * 60 * 60 * 1000,
        TOAST_DURATION_MS: 3000,
        VALID_ROLES: ['admin', 'guest'],
        MIN_VALID_TIMESTAMP: 1000000000000
    };
    window.APP_CONSTANTS = CONSTANTS;

    // Funcion debounce global (usada por otros modulos)
    window.debounce = function(func, wait) {
        var timeout;
        return function() {
            var args = arguments;
            var context = this;
            clearTimeout(timeout);
            timeout = setTimeout(function() { func.apply(context, args); }, wait);
        };
    };

    var state = {
        toast: { show: false, type: '', msg: '' }
    };

    var methods = {
        getLocalToday: function() {
            var d = new Date();
            return d.getFullYear() + '-' +
                   String(d.getMonth() + 1).padStart(2, '0') + '-' +
                   String(d.getDate()).padStart(2, '0');
        },

        formatPrice: function(amount) {
            return new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP'
            }).format(amount || 0);
        },

        formatTime: function(ts) {
            if (!ts) return '--:--';
            return new Date(ts).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        },

        formatShortDate: function(dateStr) {
            if (!dateStr) return '';
            var parts = dateStr.split('-');
            var dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            var date = new Date(dateStr + 'T12:00:00');
            var dayName = dayNames[date.getDay()];
            return dayName + ' ' + parts[2];
        },

        getWaitTime: function(timestamp) {
            if (!timestamp || timestamp < CONSTANTS.MIN_VALID_TIMESTAMP) return 0;
            var diff = Date.now() - timestamp;
            if (diff < 0) return 0;
            return Math.floor(diff / 60000);
        },

        getWaitTimeDisplay: function(timestamp) {
            var mins = this.getWaitTime(timestamp);
            if (mins === 0 && (!timestamp || timestamp < CONSTANTS.MIN_VALID_TIMESTAMP)) return 'Recién creado';
            return mins + ' min';
        },

        isToday: function(ts) {
            if (!ts) return false;
            return new Date(ts).toLocaleDateString('en-CA') === this.getLocalToday();
        },

        notify: function(type, msg) {
            this.toast = { show: true, type: type, msg: msg };
            setTimeout(function() { this.toast.show = false; }.bind(this), CONSTANTS.TOAST_DURATION_MS);
        },

        /**
         * Genera checksum simple para validar integridad de datos de sesión.
         * @param {Object} data - Objeto a hashear (se serializa con JSON.stringify)
         * @returns {string} Hash en base36
         */
        generateChecksum: function(data) {
            var str = JSON.stringify(data);
            var hash = 0;
            for (var i = 0; i < str.length; i++) {
                var char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return hash.toString(36);
        },

        getWeekRange: function(dateStr) {
            var date = new Date(dateStr + 'T12:00:00');
            var dayOfWeek = date.getDay() || 7;
            var monday = new Date(date);
            monday.setDate(date.getDate() - dayOfWeek + 1);
            var sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            var fmt = function(d) {
                return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            };
            return { start: fmt(monday), end: fmt(sunday) };
        },

        generateWeekDays: function(startDate) {
            var days = [];
            var start = new Date(startDate + 'T12:00:00');
            for (var i = 0; i < 7; i++) {
                var d = new Date(start);
                d.setDate(start.getDate() + i);
                days.push(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'));
            }
            return days;
        },

        getWeekOfYear: function(date) {
            var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            var dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        },

        getWeekStart: function(date) {
            var d = new Date(date);
            var day = d.getDay() || 7;
            d.setDate(d.getDate() - day + 1);
            return d.toISOString().split('T')[0];
        }
    };

    MammaIA.register(state, methods);
    console.log('Utils module loaded');
})();
