/**
 * MAMMA IA POS - Configuracion
 */
(function() {
    var state = {
        defaultConfig: {
            pastas: [
                { name: 'Spaguetti', hasMasa: true, allowed: ['Huevo', 'Espinaca', 'Betarraga'], priceDelta: 0 },
                { name: 'Fettuccine', hasMasa: true, allowed: ['Huevo', 'Espinaca', 'Betarraga'], priceDelta: 0 },
                { name: 'Pappardelle', hasMasa: true, allowed: ['Huevo', 'Espinaca', 'Betarraga'], priceDelta: 0 },
                { name: 'Gnocchi', hasMasa: false, allowed: [], priceDelta: 500 }
            ],
            masas: [
                { name: 'Huevo', class: 'masa-huevo', color: 'yellow' },
                { name: 'Espinaca', class: 'masa-espinaca', color: 'green' },
                { name: 'Betarraga', class: 'masa-betarraga', color: 'pink' }
            ],
            cats: [
                { id: 'roja', label: 'Rojas', class: 'btn-roja' },
                { id: 'alfredo', label: 'Blancas', class: 'btn-alfredo' },
                { id: 'carne', label: 'Carne', class: 'btn-carne' },
                { id: 'especial', label: 'Especiales', class: 'btn-especial' }
            ],
            salsas: [
                { name: 'Pomodoro', cat: 'roja', price: 6000, disabled: false },
                { name: 'Al Arrabiata', cat: 'roja', price: 6000, disabled: false },
                { name: 'Alfredo Champiñón', cat: 'alfredo', price: 6000, disabled: false },
                { name: 'Alfredo Tocino', cat: 'alfredo', price: 6000, disabled: false },
                { name: 'Alfredo Queso Azul', cat: 'alfredo', price: 6000, disabled: false },
                { name: 'Bolognesa', cat: 'carne', price: 6000, disabled: false },
                { name: 'Bolognesa Rosa', cat: 'carne', price: 6000, disabled: false },
                { name: 'All Amatriciana', cat: 'especial', price: 6000, disabled: false },
                { name: 'All Vodka', cat: 'especial', price: 6000, disabled: false }
            ],
            extras: [
                { name: 'Bebida', disabled: false, variants: [{ name: 'Coca Cola', price: 1500, disabled: false }, { name: 'Fanta', price: 1500, disabled: false }]},
                { name: 'Agua', disabled: false, variants: [{ name: 'Con Gas', price: 1200, disabled: false }, { name: 'Sin Gas', price: 1200, disabled: false }]},
                { name: 'Jugo', price: 2000, disabled: false, variants: [] },
                { name: 'Café', disabled: false, variants: [{ name: 'Expresso', price: 1500, disabled: false }, { name: 'Americano', price: 1800, disabled: false }, { name: 'Con Leche', price: 2000, disabled: false }]},
                { name: 'Té', price: 1200, disabled: false, variants: [] },
                { name: 'Queso Extra', price: 500, disabled: false, variants: [] }
            ]
        },
        config: {}
    };

    MammaIA.register(state, {});
    console.log('Config module loaded');
})();
