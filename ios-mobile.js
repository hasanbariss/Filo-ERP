/* Baris.Flow Drive — iPhone-only interaction helpers. */
(function () {
    'use strict';

    var root = document.documentElement;
    var capacitor = window.Capacitor;
    var isNative = Boolean(capacitor && typeof capacitor.isNativePlatform === 'function' && capacitor.isNativePlatform());
    var isApplePhone = /iPhone|iPod/i.test(navigator.userAgent);

    root.classList.toggle('ios-native', isNative);
    root.classList.toggle('ios-device', isNative || isApplePhone);

    function getHaptics() {
        return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    }

    window.triggerHaptic = function (strength) {
        var haptics = getHaptics();
        var numericStrength = Number(strength) || 10;
        var style = numericStrength >= 25 ? 'MEDIUM' : 'LIGHT';

        if (haptics && typeof haptics.impact === 'function') {
            haptics.impact({ style: style }).catch(function () {});
            return;
        }

        if (navigator.vibrate) {
            try { navigator.vibrate(Math.min(numericStrength, 20)); } catch (_) {}
        }
    };

    function syncDrawerState() {
        var sidebar = document.getElementById('main-sidebar');
        var hamburger = document.getElementById('hamburger-btn');
        var menuItem = document.querySelector('.nav-item-menu');
        var isOpen = Boolean(sidebar && sidebar.classList.contains('mobile-open'));

        if (hamburger) hamburger.setAttribute('aria-expanded', String(isOpen));
        if (menuItem) {
            menuItem.classList.toggle('menu-open', isOpen);
            menuItem.setAttribute('aria-expanded', String(isOpen));
        }
    }

    function pinHamburgerToViewport() {
        if (window.innerWidth > 768) return;

        var hamburger = document.getElementById('hamburger-btn');
        if (!hamburger || hamburger.parentElement === document.body) return;

        // A fixed element inside a blurred header can scroll with that header on iOS.
        // Moving the same button to body makes it truly viewport-fixed without
        // changing its click handler, accessibility attributes or menu behavior.
        document.body.appendChild(hamburger);
        hamburger.dataset.iosViewportPinned = 'true';
    }

    function setupCollapsibleNavigation() {
        document.querySelectorAll('.nav-section-toggle[data-nav-section]').forEach(function (toggle) {
            var sectionId = toggle.getAttribute('data-nav-section');
            var content = document.querySelector('[data-nav-content="' + sectionId + '"]');
            if (!content) return;

            var storageKey = 'filo-nav-section-' + sectionId;
            var savedState = null;
            try { savedState = localStorage.getItem(storageKey); } catch (_) {}

            var isOpen = savedState === null
                ? (window.innerWidth > 768 || Boolean(content.querySelector('.nav-link.active')))
                : savedState === 'open';

            var applyState = function () {
                toggle.setAttribute('aria-expanded', String(isOpen));
                content.classList.toggle('is-collapsed', !isOpen);
            };

            toggle.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                isOpen = !isOpen;
                applyState();
                try { localStorage.setItem(storageKey, isOpen ? 'open' : 'closed'); } catch (_) {}
                window.triggerHaptic(10);
            });

            applyState();
        });
    }

    function getModuleTitle(module) {
        var navButton = document.querySelector('#main-nav-buttons [data-target="' + module.id + '"]');
        if (navButton) return navButton.textContent.trim();

        var heading = module.querySelector('h1, h2, h3');
        return heading ? heading.textContent.trim() : 'Ekran İçeriği';
    }

    function enhanceModuleCollapse(module) {
        if (!module || !module.id || module.dataset.iosCollapseReady === 'true') return;

        module.dataset.iosCollapseReady = 'true';
        var storageKey = 'filo-module-view-' + module.id;
        var isExpanded = true;
        try { isExpanded = localStorage.getItem(storageKey) !== 'collapsed'; } catch (_) {}

        var control = document.createElement('div');
        control.className = 'ios-module-control';
        control.innerHTML =
            '<div class="ios-module-control-label">' +
                '<span class="ios-module-control-dot" aria-hidden="true"></span>' +
                '<span>' + getModuleTitle(module) + '</span>' +
            '</div>' +
            '<button type="button" class="ios-module-collapse-toggle" aria-expanded="true">' +
                '<span>Küçült</span>' +
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>';

        module.insertBefore(control, module.firstChild);
        Array.prototype.forEach.call(module.children, function (child) {
            if (child !== control) child.classList.add('ios-module-collapsible');
        });

        var button = control.querySelector('.ios-module-collapse-toggle');
        var buttonText = button.querySelector('span');

        var applyState = function () {
            module.classList.toggle('ios-module-collapsed', !isExpanded);
            button.setAttribute('aria-expanded', String(isExpanded));
            buttonText.textContent = isExpanded ? 'Küçült' : 'Büyüt';
        };

        button.addEventListener('click', function () {
            isExpanded = !isExpanded;
            applyState();
            try { localStorage.setItem(storageKey, isExpanded ? 'expanded' : 'collapsed'); } catch (_) {}
            window.triggerHaptic(10);
        });

        applyState();
    }

    function setupModuleCollapseControls() {
        document.querySelectorAll('.main-module[id]').forEach(enhanceModuleCollapse);
    }

    function prioritizeDashboardPolicies() {
        if (window.innerWidth > 768) return;

        var dashboard = document.getElementById('module-dashboard');
        var policyCard = document.getElementById('dashboard-policy-card');
        var firstKpi = document.getElementById('kpi-arac-main');
        var kpiGrid = firstKpi && firstKpi.closest('.grid');
        if (!dashboard || !policyCard || !kpiGrid || kpiGrid.parentElement !== dashboard) return;

        kpiGrid.parentNode.insertBefore(policyCard, kpiGrid.nextSibling);
        policyCard.classList.add('ios-priority-policy-card');
    }

    function enhanceScrollRegion(region) {
        if (!region || region.dataset.iosScrollReady === 'true') return;
        region.dataset.iosScrollReady = 'true';
        region.classList.add('ios-scroll-region');
        region.setAttribute('data-no-swipe', 'true');

        if (!region.hasAttribute('aria-label')) {
            region.setAttribute('aria-label', region.querySelector('table') ? 'Kaydırılabilir veri tablosu' : 'Yatay kaydırılabilir içerik');
        }
        region.setAttribute('role', 'region');

        var update = function () {
            var maxScroll = Math.max(0, region.scrollWidth - region.clientWidth);
            var hasOverflow = maxScroll > 4;
            region.classList.toggle('ios-has-overflow', hasOverflow);
            region.classList.toggle('ios-at-start', !hasOverflow || region.scrollLeft <= 3);
            region.classList.toggle('ios-at-end', !hasOverflow || region.scrollLeft >= maxScroll - 3);
        };

        region.addEventListener('scroll', update, { passive: true });
        requestAnimationFrame(update);
        setTimeout(update, 350);
    }

    function enhanceScrollableContent(scope) {
        var context = scope && scope.querySelectorAll ? scope : document;
        var selector = '.overflow-x-auto, .om-table-wrap, .om-tabs, [id$="-nav"], [id*="-tabs"]';
        if (context.matches && context.matches(selector)) enhanceScrollRegion(context);
        context.querySelectorAll(selector).forEach(enhanceScrollRegion);
    }

    function syncModalLock() {
        if (window.innerWidth > 768) {
            document.body.classList.remove('ios-modal-open');
            return;
        }

        var selector = [
            '#cari-kart-modal-overlay', '#cari-detail-modal', '#kredi-karti-detail-modal',
            '#general-modal', '#import-preview-modal', '#policy-detail-overlay',
            '#arac-detay-overlay', '#sofor-detay-overlay', '#toplu-arac-modal-overlay',
            '#toplu-arac-sil-modal-overlay', '#yakit-import-preview-overlay',
            '#yakit-transfer-overlay', '#manisa-fabrika-import-modal',
            '#modal-taseron-detay-rapor'
        ].join(',');

        var hasOpenModal = Array.prototype.some.call(document.querySelectorAll(selector), function (modal) {
            return !modal.classList.contains('hidden') && window.getComputedStyle(modal).display !== 'none';
        });
        document.body.classList.toggle('ios-modal-open', hasOpenModal);
    }

    function updateBottomNav(moduleId) {
        document.querySelectorAll('.mobile-bottom-nav .nav-item[data-module]').forEach(function (item) {
            var isActive = item.dataset.module === moduleId;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
    }

    function onModuleNavigation(event) {
        var button = event.target.closest('#main-nav-buttons [data-target]');
        if (!button) return;

        var targetId = button.getAttribute('data-target');
        updateBottomNav(targetId);
        window.triggerHaptic(12);

        requestAnimationFrame(function () {
            window.scrollTo({ top: 0, behavior: 'auto' });
            enhanceScrollableContent(document.getElementById(targetId));
        });
    }

    function setupKeyboardComfort() {
        if (!window.visualViewport) return;

        var updateViewport = function () {
            var viewport = window.visualViewport;
            var keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
            var activeElement = document.activeElement;
            var editableHasFocus = Boolean(activeElement && activeElement.matches && activeElement.matches('input, select, textarea, [contenteditable="true"]'));
            var isKeyboardOpen = editableHasFocus && keyboardOffset > 120;
            document.body.classList.toggle('ios-keyboard-open', isKeyboardOpen);
            root.style.setProperty('--ios-keyboard-offset', keyboardOffset + 'px');
        };

        window.visualViewport.addEventListener('resize', updateViewport, { passive: true });
        window.visualViewport.addEventListener('scroll', updateViewport, { passive: true });
        updateViewport();

        document.addEventListener('focusin', function (event) {
            if (!event.target.matches('input, select, textarea')) return;
            updateViewport();
            setTimeout(function () {
                event.target.scrollIntoView({ block: 'center', behavior: 'auto' });
            }, 280);
        });
        document.addEventListener('focusout', function () {
            setTimeout(updateViewport, 120);
        });
    }

    function setupDynamicContentObserver() {
        var queuedNodes = [];
        var scanScheduled = false;

        var scheduleAddedContentScan = function () {
            if (scanScheduled) return;
            scanScheduled = true;
            requestAnimationFrame(function () {
                scanScheduled = false;
                var nodes = queuedNodes.splice(0, queuedNodes.length);
                nodes.forEach(function (node) {
                    if (!node || node.nodeType !== 1) return;
                    var moduleParent = node.parentElement && node.parentElement.closest('.main-module[data-ios-collapse-ready="true"]');
                    if (moduleParent && node.parentElement === moduleParent && !node.classList.contains('ios-module-control')) {
                        node.classList.add('ios-module-collapsible');
                    }
                    if (node.matches && node.matches('.main-module[id]')) enhanceModuleCollapse(node);
                    node.querySelectorAll && node.querySelectorAll('.main-module[id]').forEach(enhanceModuleCollapse);
                    enhanceScrollableContent(node);
                });
                syncModalLock();
            });
        };

        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.type === 'childList' && (mutation.addedNodes.length || mutation.removedNodes.length)) {
                    if (mutation.addedNodes.length) {
                        Array.prototype.forEach.call(mutation.addedNodes, function (node) {
                            if (node.nodeType === 1) queuedNodes.push(node);
                        });
                    }
                    scheduleAddedContentScan();
                }
                if (mutation.type === 'attributes') {
                    if (mutation.target.id === 'main-sidebar') syncDrawerState();
                    if (mutation.target.matches && mutation.target.matches('#cari-detail-modal,#kredi-karti-detail-modal,#general-modal,#import-preview-modal,#modal-taseron-detay-rapor')) {
                        syncModalLock();
                    }
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    function init() {
        pinHamburgerToViewport();
        setupCollapsibleNavigation();
        prioritizeDashboardPolicies();
        setupModuleCollapseControls();
        enhanceScrollableContent(document);
        setupKeyboardComfort();
        setupDynamicContentObserver();
        syncDrawerState();
        syncModalLock();

        document.addEventListener('click', onModuleNavigation);
        document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(function (item) {
            item.addEventListener('click', function () { window.triggerHaptic(12); });
        });

        window.addEventListener('resize', function () {
            requestAnimationFrame(function () { enhanceScrollableContent(document); });
        }, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
