/*
 * Baris.Flow platform / active company branding foundation.
 *
 * This is intentionally frontend-only. The object shape can later be hydrated
 * from a Supabase companies table without changing consuming UI components.
 */
(function () {
    'use strict';

    const platform = Object.freeze({
        name: 'Baris.Flow',
        productName: 'Baris.Flow Drive',
        tagline: 'Filonuz. Tek akışta.',
        logoDarkBackground: './icons/baris-flow-logo.png',
        logoLightBackground: './icons/baris-flow-logo.png'
    });

    const currentCompany = Object.freeze({
        id: 'ideol',
        name: 'IDEOL',
        shortName: 'IDEOL',
        logo: '',
        logoDark: '',
        logoLight: '',
        address: '',
        phone: '',
        email: '',
        taxOffice: '',
        taxNumber: '',
        website: '',
        primaryColor: '#ff6b4a',
        technicalAliases: Object.freeze(['IDEOL', 'IDEOL TURİZM'])
    });

    function escapeHTML(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function absoluteAsset(path) {
        if (!path) return '';
        try { return new URL(path, document.baseURI).href; } catch (_) { return path; }
    }

    function companyDisplayName(value, useCurrentAsFallback) {
        const raw = String(value == null ? '' : value).trim();
        if (!raw) return useCurrentAsFallback === false ? '' : currentCompany.name;
        const normalized = raw.toLocaleUpperCase('tr-TR');
        const isCurrent = currentCompany.technicalAliases.some(function (alias) {
            return alias.toLocaleUpperCase('tr-TR') === normalized;
        });
        return isCurrent ? currentCompany.name : raw;
    }

    function companyDetailsText() {
        const tax = [currentCompany.taxOffice, currentCompany.taxNumber].filter(Boolean).join(' · ');
        return [currentCompany.address, currentCompany.phone, currentCompany.email, tax, currentCompany.website]
            .filter(Boolean)
            .join(' · ');
    }

    function getPlatformLogo(variant, className) {
        const onDark = variant === 'dark-background';
        const src = onDark ? platform.logoDarkBackground : platform.logoLightBackground;
        return '<img src="' + escapeHTML(absoluteAsset(src)) + '" alt="' + escapeHTML(platform.name) + '" class="platform-logo platform-logo--' + (onDark ? 'dark-bg' : 'light-bg') + (className ? ' ' + escapeHTML(className) : '') + '">';
    }

    function getCompanyMark(className) {
        const logo = currentCompany.logoLight || currentCompany.logo || currentCompany.logoDark;
        if (logo) {
            return '<img src="' + escapeHTML(absoluteAsset(logo)) + '" alt="' + escapeHTML(currentCompany.name) + '" class="company-logo' + (className ? ' ' + escapeHTML(className) : '') + '">';
        }
        return '<span class="company-wordmark' + (className ? ' ' + escapeHTML(className) : '') + '" role="img" aria-label="' + escapeHTML(currentCompany.name) + '">' + escapeHTML(currentCompany.shortName) + '</span>';
    }

    function getPrintStyles() {
        return [
            '.company-print-header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin:0 0 20px;padding:0 0 14px;border-bottom:2px solid #e2e8f0;color:#0f172a}',
            '.company-print-heading{min-width:0}',
            '.company-print-heading h1{margin:0;font:800 20px/1.2 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a;letter-spacing:-.02em}',
            '.company-print-heading p{margin:5px 0 0;font:600 10px/1.45 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#64748b}',
            '.company-print-identity{flex:0 0 auto;max-width:42%;text-align:right}',
            '.company-print-identity .company-wordmark{display:block;font:900 20px/1 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.08em;color:' + currentCompany.primaryColor + '}',
            '.company-print-identity .company-logo{display:block;max-width:150px;max-height:54px;margin-left:auto;object-fit:contain}',
            '.company-print-name{margin-top:5px;font:800 9px/1.3 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#334155;letter-spacing:.04em}',
            '.company-print-details{margin-top:3px;font:500 8px/1.4 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#64748b}',
            '.platform-print-footer{display:flex;justify-content:space-between;gap:18px;margin-top:28px;padding-top:9px;border-top:1px solid #e2e8f0;font:500 8px/1.4 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#94a3b8}',
            '.platform-print-footer span:last-child{text-align:right}',
            '@media print{.company-print-header,.platform-print-footer{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
        ].join('');
    }

    function getPrintHeader(options) {
        const opts = options || {};
        const details = companyDetailsText();
        const hasCompanyLogo = Boolean(currentCompany.logoLight || currentCompany.logo || currentCompany.logoDark);
        return '<header class="company-print-header" data-company-print-header>'
            + '<div class="company-print-heading"><h1>' + escapeHTML(opts.title || 'Belge') + '</h1>'
            + (opts.subtitle ? '<p>' + escapeHTML(opts.subtitle) + '</p>' : '') + '</div>'
            + '<div class="company-print-identity">' + getCompanyMark()
            + (hasCompanyLogo ? '<div class="company-print-name">' + escapeHTML(currentCompany.name) + '</div>' : '')
            + (details ? '<div class="company-print-details">' + escapeHTML(details) + '</div>' : '')
            + '</div></header>';
    }

    function getPrintFooter(meta) {
        return '<footer class="platform-print-footer" data-platform-print-footer><span>'
            + escapeHTML(meta || new Date().toLocaleString('tr-TR'))
            + '</span><span>Baris.Flow ile oluşturuldu</span></footer>';
    }

    function decoratePrintRoot(root, options) {
        if (!root) return;
        root.querySelectorAll('[data-company-print-header],[data-platform-print-footer]').forEach(function (node) { node.remove(); });
        root.insertAdjacentHTML('afterbegin', getPrintHeader(options));
        root.insertAdjacentHTML('beforeend', getPrintFooter(options && options.footerMeta));
    }

    function printElement(selector, options) {
        const source = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!source) return;
        const opts = options || {};
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write('<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>'
            + escapeHTML(opts.title || 'Belge') + '</title><style>' + getPrintStyles()
            + 'body{margin:0;padding:28px;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a;background:#fff}'
            + 'table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:7px 8px;border:1px solid #e2e8f0;text-align:left}th{background:#f8fafc;font-weight:800}.text-right{text-align:right}.no-print,button,input,select{display:none!important}'
            + '@page{size:A4 landscape;margin:10mm}</style></head><body>'
            + getPrintHeader(opts) + source.innerHTML + getPrintFooter(opts.footerMeta)
            + '</body></html>');
        printWindow.document.close();
        printWindow.focus();
        printWindow.setTimeout(function () { printWindow.print(); printWindow.close(); }, 350);
    }

    function addPdfBranding(doc, options) {
        if (!doc) return;
        const opts = options || {};
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.text(String(opts.title || 'Rapor'), 14, 15);
        doc.setTextColor(255, 107, 74);
        doc.setFontSize(13);
        doc.text(currentCompany.shortName, pageWidth - 14, 15, { align: 'right' });
        if (opts.subtitle) {
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(9);
            doc.text(String(opts.subtitle), 14, 22);
        }
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text('Baris.Flow ile oluşturuldu', pageWidth - 14, pageHeight - 7, { align: 'right' });
    }

    function applyRuntimeBranding() {
        document.querySelectorAll('[data-company-name]').forEach(function (node) {
            node.textContent = currentCompany.name;
        });
        document.querySelectorAll('[data-company-short-name]').forEach(function (node) {
            node.textContent = currentCompany.shortName;
        });
        document.querySelectorAll('[data-platform-name]').forEach(function (node) {
            node.textContent = platform.name;
        });
        document.querySelectorAll('[data-platform-logo]').forEach(function (image) {
            const variant = image.getAttribute('data-platform-logo');
            const path = variant === 'dark-background' ? platform.logoDarkBackground : platform.logoLightBackground;
            image.setAttribute('src', path);
            image.setAttribute('alt', platform.name);
        });
        document.documentElement.style.setProperty('--company-primary', currentCompany.primaryColor);
    }

    window.CompanyBranding = Object.freeze({
        platform: platform,
        currentCompany: currentCompany,
        companyDisplayName: companyDisplayName,
        getPlatformLogo: getPlatformLogo,
        getCompanyMark: getCompanyMark,
        getPrintStyles: getPrintStyles,
        getPrintHeader: getPrintHeader,
        getPrintFooter: getPrintFooter,
        decoratePrintRoot: decoratePrintRoot,
        printElement: printElement,
        addPdfBranding: addPdfBranding,
        applyRuntimeBranding: applyRuntimeBranding
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyRuntimeBranding);
    } else {
        applyRuntimeBranding();
    }
})();
