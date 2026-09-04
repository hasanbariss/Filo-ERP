(function () {
    'use strict';

    var MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

    function validMonth(value) {
        return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''));
    }

    function labelFor(value) {
        if (!validMonth(value)) return 'Dönem seçin';
        var parts = value.split('-');
        return MONTHS[Number(parts[1]) - 1] + ' ' + parts[0];
    }

    function buildValues(input) {
        var now = new Date();
        var selected = validMonth(input.value) ? input.value : '';
        var minYear = input.min && validMonth(input.min) ? Number(input.min.slice(0, 4)) : now.getFullYear() - 7;
        var maxYear = input.max && validMonth(input.max) ? Number(input.max.slice(0, 4)) : now.getFullYear() + 2;
        if (selected) {
            minYear = Math.min(minYear, Number(selected.slice(0, 4)));
            maxYear = Math.max(maxYear, Number(selected.slice(0, 4)));
        }
        var values = [];
        for (var year = maxYear; year >= minYear; year -= 1) {
            for (var month = 12; month >= 1; month -= 1) values.push(year + '-' + String(month).padStart(2, '0'));
        }
        return values;
    }

    function enhance(input) {
        if (!input || input.dataset.trMonthEnhanced === 'true') return;
        input.dataset.trMonthEnhanced = 'true';

        var select = document.createElement('select');
        select.className = input.className + ' bf-tr-month-select';
        select.id = input.id ? input.id + '-tr' : '';
        select.setAttribute('aria-label', input.getAttribute('aria-label') || 'Ay ve yıl seçin');
        select.innerHTML = buildValues(input).map(function (value) {
            return '<option value="' + value + '">' + labelFor(value) + '</option>';
        }).join('');

        var nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        var currentValue = input.value;
        Object.defineProperty(input, 'value', {
            configurable: true,
            get: function () { return nativeValue.get.call(input); },
            set: function (value) {
                nativeValue.set.call(input, value);
                if (validMonth(value)) select.value = value;
            }
        });

        if (validMonth(currentValue)) select.value = currentValue;
        else {
            var now = new Date();
            select.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        }
        select.addEventListener('change', function () {
            nativeValue.set.call(input, select.value);
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        input.hidden = true;
        input.setAttribute('aria-hidden', 'true');
        input.insertAdjacentElement('afterend', select);
    }

    function enhanceAll(root) {
        (root || document).querySelectorAll('input[type="month"]').forEach(enhance);
    }

    function init() {
        if (!document.getElementById('bf-tr-month-style')) {
            var style = document.createElement('style');
            style.id = 'bf-tr-month-style';
            style.textContent = '.bf-tr-month-select{min-width:142px;cursor:pointer}.bf-tr-month-select option{font-style:normal}';
            document.head.appendChild(style);
        }
        enhanceAll(document);
        new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    if (node.matches && node.matches('input[type="month"]')) enhance(node);
                    enhanceAll(node);
                });
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
