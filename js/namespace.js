/**
 * MAMMA IA POS - Namespace Global
 * Este archivo DEBE cargarse antes que todos los demas modulos.
 * Crea un objeto global que acumula todas las propiedades y metodos.
 *
 * Usa Object.defineProperties para preservar getters de Alpine.js.
 * Object.assign y spread invocan los getters en vez de copiarlos,
 * lo que causaria errores porque el estado aun no existe.
 */

window.MammaIA = {
    // Propiedades de estado - se agregan aqui desde cada modulo
    _state: {},

    // Descriptores de metodos - se agregan aqui desde cada modulo
    _methodDescriptors: {},

    // Funcion para registrar un modulo
    register: function(moduleState, moduleMethods) {
        Object.assign(this._state, moduleState || {});
        if (moduleMethods) {
            var descriptors = Object.getOwnPropertyDescriptors(moduleMethods);
            Object.assign(this._methodDescriptors, descriptors);
        }
    },

    // Funcion que genera el objeto final para Alpine
    createApp: function() {
        var result = {};
        Object.assign(result, this._state);
        Object.defineProperties(result, this._methodDescriptors);
        return result;
    }
};

console.log('MammaIA namespace creado');
