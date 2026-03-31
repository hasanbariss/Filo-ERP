// ============================================================
// TOAST-MANAGER.JS
// alert() yerine kullanılan animasyonlu bildirim sistemi
// ============================================================
(function () {
    'use strict';

    window.Toast = {
        show: function (message, type, duration) {
            type = type || 'info';
            duration = duration || 4000;

            var container = this._getContainer();
            var toast = this._createToast(message, type);
            container.appendChild(toast);

            // Animate in (requestAnimationFrame ensures CSS transition fires)
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    toast.style.transform = 'translateX(0)';
                    toast.style.opacity = '1';
                });
            });

            // Auto remove
            var self = this;
            var removeTimeout = setTimeout(function () {
                self._remove(toast);
            }, duration);

            // Click to close early
            toast.addEventListener('click', function () {
                clearTimeout(removeTimeout);
                self._remove(toast);
            });

            return toast;
        },

        success: function (msg) { return this.show(msg, 'success', 4000); },
        error: function (msg) { return this.show(msg, 'error', 6000); },
        warning: function (msg) { return this.show(msg, 'warning', 5000); },
        info: function (msg) { return this.show(msg, 'info', 4000); },

        _remove: function (toast) {
            toast.style.transform = 'translateX(420px)';
            toast.style.opacity = '0';
            setTimeout(function () {
                if (toast.parentElement) toast.parentElement.removeChild(toast);
            }, 350);
        },

        _getContainer: function () {
            var container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.setAttribute('aria-live', 'polite');
                container.setAttribute('aria-label', 'Bildirimler');
                container.style.cssText = [
                    'position:fixed',
                    'top:80px',
                    'right:20px',
                    'z-index:99999',
                    'display:flex',
                    'flex-direction:column',
                    'gap:10px',
                    'max-width:380px',
                    'width:calc(100vw - 40px)',
                    'pointer-events:none'
                ].join(';');
                document.body.appendChild(container);
            }
            return container;
        },

        _createToast: function (message, type) {
            var TYPES = {
                success: { bg: 'linear-gradient(135deg,#059669,#10b981)', icon: '✓', border: '#10b981' },
                error:   { bg: 'linear-gradient(135deg,#dc2626,#ef4444)', icon: '✕', border: '#ef4444' },
                warning: { bg: 'linear-gradient(135deg,#d97706,#f59e0b)', icon: '⚠', border: '#f59e0b' },
                info:    { bg: 'linear-gradient(135deg,#2563eb,#3b82f6)', icon: 'ℹ', border: '#3b82f6' }
            };

            var t = TYPES[type] || TYPES.info;

            var toast = document.createElement('div');
            toast.setAttribute('role', 'alert');
            toast.style.cssText = [
                'background:' + t.bg,
                'color:#fff',
                'padding:13px 16px',
                'border-radius:12px',
                'box-shadow:0 8px 32px rgba(0,0,0,0.35),0 0 0 1px ' + t.border + '33',
                'display:flex',
                'align-items:center',
                'gap:10px',
                'font-size:13.5px',
                'font-weight:600',
                'line-height:1.4',
                'transform:translateX(420px)',
                'opacity:0',
                'transition:transform .35s cubic-bezier(.4,0,.2,1),opacity .35s ease',
                'cursor:pointer',
                'pointer-events:all',
                'backdrop-filter:blur(12px)',
                'max-width:100%',
                'word-break:break-word',
                'user-select:none'
            ].join(';');

            // Icon
            var iconEl = document.createElement('span');
            iconEl.textContent = t.icon;
            iconEl.style.cssText = 'font-size:17px;flex-shrink:0;min-width:20px;text-align:center';

            // Message (textContent = XSS safe)
            var msgEl = document.createElement('span');
            msgEl.style.flex = '1';
            msgEl.textContent = message;

            // Close button
            var closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.setAttribute('aria-label', 'Kapat');
            closeBtn.style.cssText = [
                'background:none',
                'border:none',
                'color:rgba(255,255,255,.75)',
                'font-size:20px',
                'line-height:1',
                'cursor:pointer',
                'padding:0 2px',
                'flex-shrink:0',
                'transition:color .2s'
            ].join(';');
            closeBtn.addEventListener('mouseover', function () { this.style.color = '#fff'; });
            closeBtn.addEventListener('mouseout', function () { this.style.color = 'rgba(255,255,255,.75)'; });

            toast.appendChild(iconEl);
            toast.appendChild(msgEl);
            toast.appendChild(closeBtn);

            return toast;
        }
    };

    window.log && window.log('[Toast] Toast Manager hazır');

})();
