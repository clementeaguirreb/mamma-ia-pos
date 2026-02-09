/**
 * MAMMA IA POS - Autenticacion
 */
(function() {
    var state = {
        isLoggedIn: false,
        userRole: null,
        pinInput: '',
        loginError: '',
        loginAttempts: 0,
        loginLockUntil: 0,
        maxLoginAttempts: 5,
        lockoutMinutes: 15,
        pins: { admin: null, guest: null },
        newAdminPin: '',
        newGuestPin: ''
    };

    var methods = {
        loadSession: function() {
            try {
                var savedSession = localStorage.getItem('mammaiaSession');
                if (savedSession) {
                    var session = JSON.parse(savedSession);

                    // Verificar checksum
                    var dataToVerify = { userRole: session.userRole, timestamp: session.timestamp };
                    if (session.checksum !== this.generateChecksum(dataToVerify)) {
                        console.warn('Sesión corrupta detectada');
                        localStorage.removeItem('mammaiaSession');
                        return;
                    }

                    // Verificar que la sesion no tenga mas de 24 horas
                    var now = Date.now();
                    var sessionAge = now - (session.timestamp || 0);
                    var maxAge = APP_CONSTANTS.SESSION_MAX_AGE_MS;

                    // Verificar rol valido
                    if (!APP_CONSTANTS.VALID_ROLES.includes(session.userRole)) {
                        localStorage.removeItem('mammaiaSession');
                        return;
                    }

                    if (sessionAge < maxAge && session.userRole) {
                        this.userRole = session.userRole;
                        this.isLoggedIn = true;
                    } else {
                        localStorage.removeItem('mammaiaSession');
                    }
                }
            } catch (e) {
                console.error('Error cargando sesión:', e);
                localStorage.removeItem('mammaiaSession');
            }
        },

        saveSession: function() {
            try {
                var data = {
                    userRole: this.userRole,
                    timestamp: Date.now()
                };
                var session = {
                    userRole: data.userRole,
                    timestamp: data.timestamp,
                    checksum: this.generateChecksum(data)
                };
                localStorage.setItem('mammaiaSession', JSON.stringify(session));
            } catch (e) {
                console.error('Error guardando sesión:', e);
            }
        },

        clearSession: function() {
            try {
                localStorage.removeItem('mammaiaSession');
            } catch (e) {
                console.error('Error limpiando sesión:', e);
            }
        },

        initAuth: function() {
            var self = this;
            auth.signInAnonymously()
                .then(function() {
                    self.loadPins();
                    self.setupListeners();
                })
                .catch(function(error) {
                    console.error('Error auth:', error);
                    self.notify('error', 'Error de conexión');
                    self.loading = false;
                });
        },

        loadPins: function() {
            var self = this;
            db.ref('pins').once('value', function(s) {
                if (s.val()) {
                    self.pins = s.val();
                } else {
                    // Defaults solo para primera inicialización
                    var defaults = { admin: '123456', guest: '0000' };
                    self.pins = defaults;
                    db.ref('pins').set(defaults);
                    console.warn('PINs inicializados con valores por defecto. Cámbialos en Admin > Configuración de Acceso.');
                }
            });
        },

        login: function() {
            this.loginError = '';

            // Verificar si esta bloqueado
            if (this.loginLockUntil > Date.now()) {
                var minsLeft = Math.ceil((this.loginLockUntil - Date.now()) / 60000);
                this.loginError = 'Bloqueado. Espera ' + minsLeft + ' min';
                this.pinInput = '';
                return;
            }

            // Resetear intentos si paso el tiempo
            if (this.loginLockUntil && Date.now() > this.loginLockUntil) {
                this.loginAttempts = 0;
                this.loginLockUntil = 0;
            }

            if (this.pinInput === this.pins.admin) {
                this.userRole = 'admin';
                this.isLoggedIn = true;
                this.loginAttempts = 0;
                this.saveSession();
                this.notify('success', 'Bienvenido Admin');
            } else if (this.pinInput === this.pins.guest) {
                this.userRole = 'guest';
                this.isLoggedIn = true;
                this.view = 'pos';
                this.loginAttempts = 0;
                this.saveSession();
                this.notify('success', 'Bienvenido');
            } else {
                this.loginAttempts++;
                if (this.loginAttempts >= this.maxLoginAttempts) {
                    this.loginLockUntil = Date.now() + (this.lockoutMinutes * 60 * 1000);
                    this.loginError = 'Demasiados intentos. Bloqueado ' + this.lockoutMinutes + ' min';
                } else {
                    var remaining = this.maxLoginAttempts - this.loginAttempts;
                    this.loginError = 'PIN incorrecto (' + remaining + ' intentos restantes)';
                }
            }
            this.pinInput = '';
        },

        logout: function() {
            if (confirm('¿Cerrar sesión?')) {
                this.isLoggedIn = false;
                this.userRole = null;
                this.view = 'pos';
                this.stockLocked = true;
                this.adminLocked = true;
                this.clearSession();
            }
        },

        validatePin: function(pin) {
            if (!pin || pin.length < 4 || pin.length > 6) return false;
            if (!/^\d+$/.test(pin)) return false;
            return true;
        },

        savePins: function() {
            var errors = [];

            if (this.newAdminPin && !this.validatePin(this.newAdminPin)) {
                errors.push('PIN Admin debe ser 4-6 dígitos');
            }
            if (this.newGuestPin && !this.validatePin(this.newGuestPin)) {
                errors.push('PIN Invitado debe ser 4-6 dígitos');
            }

            if (errors.length > 0) {
                this.notify('error', errors.join('. '));
                return;
            }

            if (this.newAdminPin && this.validatePin(this.newAdminPin)) {
                this.pins.admin = this.newAdminPin;
            }
            if (this.newGuestPin && this.validatePin(this.newGuestPin)) {
                this.pins.guest = this.newGuestPin;
            }

            var self = this;
            db.ref('pins').set(this.pins)
                .then(function() {
                    self.newAdminPin = '';
                    self.newGuestPin = '';
                    self.notify('success', 'PINs actualizados');
                })
                .catch(function(err) {
                    console.error('[Auth] Error guardando PINs:', err);
                    self.notify('error', 'Error al guardar PINs');
                });
        }
    };

    MammaIA.register(state, methods);
    console.log('Auth module loaded');
})();
