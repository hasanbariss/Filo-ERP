const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage();
    await page.route('https://hakedis.test/**', route => route.fulfill({
        contentType: 'text/html', body: '<body><div id="taseron-finans-month"></div></body>'
    }));
    await page.goto('https://hakedis.test/');
    for (const file of ['company-branding.js', 'hakedis-calculations.js'])
        await page.addScriptTag({ path: process.cwd() + '/' + file });
    const source = fs.readFileSync('data-services.js', 'utf8');
    await page.addScriptTag({ content: source.slice(
        source.indexOf('window.openCariHakedisDetay ='),
        source.indexOf('window.saveHakedisFiyatlar =')
    ) });
    const ui = fs.readFileSync('ui-manager.js', 'utf8');
    await page.addScriptTag({ content: ui.slice(
        ui.indexOf('window.printCariKart ='), ui.indexOf('/* === 9. HARİTA')
    ) });
    await page.evaluate(() => {
        window.printTestCompany = window.CompanyBranding.currentCompany;
        window.CompanyBranding = { ...window.CompanyBranding, currentCompany: {
            ...window.CompanyBranding.currentCompany, legalName: '', taxNumber: '', taxOffice: '', address: ''
        }};
        window._taseronCariAy = '2026-09';
        window._taseronCariData = { v: {
            plaka: '35 TEST 01', sahip_bilgisi: 'Örnek Taşımacılık', mulkiyet_durumu: 'TAŞERON',
            musteriDetay: { f: {
                musteri_ad: 'Örnek Fabrika', vardiya: 22, tek: 4,
                vardiya_fiyat: 1000, tek_fiyat: 500, kdv_oran: 20, tev_oran: 4
            } }
        } };
        window.supabaseClient = { from(table) {
            const q = new Proxy({}, { get: (_, key) => key === 'then'
                ? resolve => Promise.resolve({ data: table === 'yakit_takip'
                    ? [{ id: 'fuel1', tarih: '2026-09-03', litre: 100, birim_fiyat: 50, toplam_tutar: 5000 }]
                    : [] }).then(resolve) : () => q });
            return q;
        } };
        localStorage.setItem('cari_manuel_other_2026-09', JSON.stringify([{tip:'gelir',tutar:999999,baslik:'Başka araç'}]));
    });
    await page.evaluate(() => openCariHakedisDetay('v'));
    await page.evaluate(() => {
        addManuelKalem('gelir');
        const row = document.querySelector('.manuel-kalem-row');
        row.querySelector('.manuel-baslik').value = 'Ek hizmet <img src=x onerror=alert(1)>';
        row.querySelector('.manuel-tutar').value = '1200';
        row.querySelector('.manuel-kdv-oran').value = '20';
        row.querySelector('.manuel-kdv-dahil').value = 'dahil';
        row.querySelector('.manuel-tutar').dispatchEvent(new Event('input', {bubbles:true}));
    });
    async function print() {
        const popupEvent = page.waitForEvent('popup');
        await page.evaluate(() => printCariKart('35 TEST 01', '2026-09'));
        const popup = await popupEvent;
        await popup.waitForLoadState('domcontentloaded');
        return popup;
    }
    const printed = await print();
    assert.match(await printed.locator('body').innerText(), /Eylül 2026/);
    assert.match(await printed.locator('body').innerText(), /Örnek Fabrika/);
    assert.match(await printed.locator('body').innerText(), /03\.09\.2026/);
    assert.match(await printed.locator('body').innerText(), /100 Lt x ₺50/);
    assert.match(await printed.locator('body').innerText(), /Bilgi tanımlanmamış/);
    assert.doesNotMatch(await printed.locator('body').innerText(), /Başka araç/);
    assert.equal(await printed.locator('img').count(), 0);
    const summary = await printed.locator('.summary-grid').innerText();
    assert.match(summary, /25\.000,00 TL/); // 24,000 services + 1,000 net manual base
    assert.match(summary, /30\.000,00 TL/); // base + VAT
    assert.match(summary, /29\.040,00 TL/); // less TEV
    assert.match(summary, /24\.040,00 TL/); // less fuel
    assert.match(await page.locator('#modal-net-total').innerText(), /24\.040,00/);
    await printed.emulateMedia({media:'print'});
    assert.equal(await printed.locator('.print-tools').isVisible(), false);
    if (process.env.PRINT_QA_DIR) {
        fs.mkdirSync(process.env.PRINT_QA_DIR, {recursive:true});
        await printed.pdf({path:process.env.PRINT_QA_DIR+'/hakedis-ornek.pdf',preferCSSPageSize:true,printBackground:true});
    }
    await printed.close();
    await page.evaluate(() => {
        window.CompanyBranding = {...window.CompanyBranding, currentCompany: window.printTestCompany};
        document.querySelector('.manuel-baslik').value = 'Ek servis hizmeti';
    });
    await page.evaluate(() => {
        const list = document.querySelector('#yakitlar-list-container');
        for (let i=0;i<11;i++) list.append(list.firstElementChild.cloneNode(true));
    });
    const actualCompany = await print();
    await actualCompany.emulateMedia({media:'print'});
    assert.ok(await actualCompany.locator('.sheet').evaluate(el => el.getBoundingClientRect().height < 1030));
    assert.equal(await actualCompany.locator('.fuel-ledger tbody tr').count(), 6);
    assert.match(await actualCompany.locator('.billing').innerText(), /4700570855/);
    assert.match(await actualCompany.locator('.billing').innerText(), /Mesir/);
    if (process.env.PRINT_QA_DIR) await actualCompany.pdf({
        path:process.env.PRINT_QA_DIR+'/hakedis-fatura-bilgileri.pdf',preferCSSPageSize:true,printBackground:true
    });
    await actualCompany.close();
    await page.evaluate(() => {
        const list = document.querySelector('#yakitlar-list-container');
        while(list.children.length > 1) list.lastElementChild.remove();
    });
    // Unsaved fractional edits and negative manual lines must match the editor.
    await page.evaluate(() => {
        document.querySelector('.calc-vardiya-count').value = '22.5';
        document.querySelector('.calc-vardiya-count').dispatchEvent(new Event('input',{bubbles:true}));
        addManuelKalem('gider');
        const row = document.querySelectorAll('.manuel-kalem-row')[1];
        row.querySelector('.manuel-baslik').value = 'Düzeltme';
        row.querySelector('.manuel-tutar').value = '100';
        row.querySelector('.manuel-tutar').dispatchEvent(new Event('input',{bubbles:true}));
        // Deliberately stale saved values must not leak into print.
        localStorage.setItem('cari_manuel_v_2026-09','[]');
    });
    const updated = await print();
    assert.match(await updated.locator('.summary-grid').innerText(), /24\.520,00 TL/);
    assert.match(await page.locator('#modal-net-total').innerText(), /24\.520,00/);
    await updated.close();
    await page.evaluate(() => {
        window.CompanyBranding = {...window.CompanyBranding, currentCompany: {
            ...window.CompanyBranding.currentCompany,
            legalName: 'Örnek Firma & Ortakları', taxOffice: 'Örnek Vergi Dairesi',
            taxNumber: '0000000000', address: 'Örnek Mahallesi, No: 1, İzmir'
        }};
    });
    const billing = await print();
    assert.match(await billing.locator('.billing').innerText(), /Örnek Firma & Ortakları/);
    assert.match(await billing.locator('.billing').innerText(), /0000000000/);
    assert.doesNotMatch(await billing.locator('.billing').innerText(), /Bilgi tanımlanmamış/);
    await billing.close();
    // Every fuel record remains present in paired compact rows.
    await page.evaluate(() => {
        const list = document.querySelector('#yakitlar-list-container');
        for (let i=0;i<65;i++) list.append(list.firstElementChild.cloneNode(true));
    });
    const long = await print();
    await long.emulateMedia({media:'print'});
    assert.equal(await long.locator('.fuel-ledger tbody tr').count(), 33);
    assert.equal((await long.locator('.fuel-ledger').innerText()).match(/03\.09\.2026/g).length, 66);
    assert.match(await long.locator('.summary-grid').innerText(), /5\.000,00 TL/);
    if (process.env.PRINT_QA_DIR) await long.pdf({
        path:process.env.PRINT_QA_DIR+'/hakedis-uzun.pdf',preferCSSPageSize:true,printBackground:true
    });
    assert.equal(await long.locator('.billing').count(), 1);
    await browser.close();
    console.log('Hakediş print: current editor totals, VAT, TEV, compact fuel summary, period isolation, escaping and print controls PASS');
})().catch(error => { console.error(error); process.exit(1); });
