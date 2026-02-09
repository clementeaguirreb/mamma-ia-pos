/**
 * MAMMA IA POS v7.0 - App Principal
 * Este archivo DEBE cargarse AL FINAL, despues de todos los modulos.
 */

// Variables globales para graficos (necesarias para cleanup)
var chartDaysInstance = null;
var chartHoursInstance = null;

// Inicializar Firebase
if (typeof window.firebaseConfig === 'undefined') {
    console.error('Firebase config no encontrada. Asegurate de tener firebase-config.js');
    alert('Error: Configuración de Firebase no encontrada.\n\nPor favor crea firebase-config.js basado en firebase-config.example.js');
} else {
    if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
}

var db = firebase.database();
var auth = firebase.auth();

// Funcion principal para Alpine.js
function app() {
    // Agregar estado base que no esta en ningun modulo
    MammaIA.register({
        view: 'pos',
        loading: true,
        online: true,
        cartDrawerOpen: false,
        tabs: [
            { id: 'pos', icon: 'fa-solid fa-cash-register', label: 'Caja', roles: ['admin', 'guest'] },
            { id: 'kitchen', icon: 'fa-solid fa-fire-burner', label: 'Cocina', roles: ['admin'] },
            { id: 'stock', icon: 'fa-solid fa-boxes-stacked', label: 'Stock', roles: ['admin'] },
            { id: 'stats', icon: 'fa-solid fa-chart-line', label: 'Stats', roles: ['admin'] },
            { id: 'admin', icon: 'fa-solid fa-gear', label: 'Admin', roles: ['admin'] }
        ]
    }, {
        // Getters (computed properties)
        get cartTotal() {
            return this.cart.reduce(function(s, i) { return s + i.price; }, 0);
        },

        get pendingCount() {
            return this.orders.filter(function(o) { return o.status === 'Pendiente'; }).length;
        },

        get todayDishCount() {
            var today = this.getLocalToday();
            return this.orders
                .filter(function(o) { return o.date === today; })
                .reduce(function(count, order) {
                    return count + (order.items || []).filter(function(i) { return i.type === 'dish'; }).length;
                }, 0);
        },

        get visibleTabs() {
            var role = this.userRole;
            return this.tabs.filter(function(t) { return t.roles.includes(role); });
        },

        get filteredOrders() {
            var from = this.dateFrom;
            var to = this.dateTo;
            return this.orders.filter(function(o) { return o.date >= from && o.date <= to; }).sort(function(a, b) { return b.timestamp - a.timestamp; });
        },

        get dailyDishStats() {
            var stats = {};
            this.filteredOrders.forEach(function(o) {
                var dishCount = (o.items || []).filter(function(i) { return i.type === 'dish'; }).length;
                if (dishCount > 0) {
                    if (!stats[o.date]) stats[o.date] = { date: o.date, count: 0 };
                    stats[o.date].count += dishCount;
                }
            });
            return Object.values(stats).sort(function(a, b) { return a.date.localeCompare(b.date); });
        },

        changeView: function(viewId) {
            var tab = this.tabs.find(function(t) { return t.id === viewId; });
            var role = this.userRole;
            if (tab && tab.roles.includes(role)) {
                this.view = viewId;
                if (viewId === 'stats') {
                    this.initStatsWithData();
                }
            } else {
                this.notify('warning', 'Sin acceso');
            }
        },

        // Init se define aqui para asegurar que tiene acceso a todo
        init: function() {
            console.log('MammaIA POS iniciando...');
            this.dateFrom = this.getLocalToday();
            this.dateTo = this.getLocalToday();
            this.loadSession();
            this.initAuth();
        }
    });

    // Crear y retornar el objeto para Alpine
    return MammaIA.createApp();
}

// Cleanup al cerrar
window.addEventListener('beforeunload', function() {
    if (chartDaysInstance) chartDaysInstance.destroy();
    if (chartHoursInstance) chartHoursInstance.destroy();
    db.ref('config').off();
    db.ref('orders').off();
    db.ref('stock').off();
    db.ref('.info/connected').off();
});

console.log('App module loaded - Ready');
