(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.ReportAnalytics = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    function number(value) {
        var parsed = typeof value === 'number' ? value : Number(String(value == null ? '' : value).replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function monthValue(date) {
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    }

    function periodBounds(value) {
        var safe = /^\d{4}-\d{2}$/.test(String(value || '')) ? String(value) : monthValue(new Date());
        var parts = safe.split('-').map(Number);
        var year = parts[0];
        var month = parts[1];
        var previousDate = new Date(year, month - 2, 1);
        var previousValue = monthValue(previousDate);
        var previousParts = previousValue.split('-').map(Number);
        var formatter = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
        return {
            value: safe,
            start: safe + '-01',
            end: safe + '-' + String(new Date(year, month, 0).getDate()).padStart(2, '0'),
            label: formatter.format(new Date(year, month - 1, 1)),
            previousValue: previousValue,
            previousStart: previousValue + '-01',
            previousEnd: previousValue + '-' + String(new Date(previousParts[0], previousParts[1], 0).getDate()).padStart(2, '0'),
            previousLabel: formatter.format(previousDate)
        };
    }

    function percentChange(current, previous) {
        var before = number(previous);
        return before > 0 ? ((number(current) - before) / before) * 100 : null;
    }

    function sum(rows, field) {
        return (rows || []).reduce(function (total, row) { return total + number(row && row[field]); }, 0);
    }

    function payrollValue(row) {
        return number(row && row.net_maas) - Math.abs(number(row && row.avans)) - number(row && row.ceza) - number(row && row.haciz);
    }

    function summarize(data) {
        data = data || {};
        var fuelLiters = sum(data.fuel, 'litre');
        var fuelCost = sum(data.fuel, 'toplam_tutar');
        var contractorAccrual = (data.contractorAccrual || []).reduce(function (total, row) {
            return total + number(row && (row.net_hakedis != null ? row.net_hakedis : row.anlasilan_tutar));
        }, 0);
        var serviceAccrual = sum(data.serviceAccrual, 'gunluk_ucret');
        var accrual = contractorAccrual + serviceAccrual;
        var shifts = sum(data.serviceAccrual, 'vardiya');
        var trips = sum(data.serviceAccrual, 'tek');
        var payroll = (data.payroll || []).reduce(function (total, row) { return total + number(row && row.net_maas); }, 0);
        var advances = Math.abs((data.finance || []).filter(function (row) {
            return row && (row.islem_turu === 'AVANS' || row.islem_turu === 'KESİNTİ (Ceza/Hasar)');
        }).reduce(function (total, row) { return total + number(row && row.tutar); }, 0));
        var maintenance = sum(data.maintenance, 'toplam_tutar');
        var policies = sum(data.policies, 'toplam_tutar');
        var cardSpend = sum(data.cardTransactions, 'toplam_tutar');
        return {
            fuelCost: fuelCost,
            fuelLiters: fuelLiters,
            fuelCount: (data.fuel || []).length,
            maintenance: maintenance,
            maintenanceCount: (data.maintenance || []).length,
            policies: policies,
            policyCount: (data.policies || []).length,
            payroll: payroll,
            payrollCount: (data.payroll || []).length,
            advances: advances,
            contractorAccrual: contractorAccrual,
            serviceAccrual: serviceAccrual,
            shifts: shifts,
            trips: trips,
            operations: shifts + trips,
            cardSpend: cardSpend,
            cardTransactionCount: (data.cardTransactions || []).length,
            accrual: accrual,
            accrualCount: (data.contractorAccrual || []).length + (data.serviceAccrual || []).length,
            totalExpense: fuelCost + maintenance + policies + payroll + advances,
            operatingDifference: accrual - (fuelCost + maintenance + policies + payroll + advances)
        };
    }

    function groupVehicles(current, previous, vehicles) {
        var groups = new Map();
        var vehicleNames = new Map((vehicles || []).map(function (row) { return [String(row.id), row.plaka || String(row.id)]; }));
        function add(rows, field, period) {
            (rows || []).forEach(function (row) {
                var id = String(row && row.arac_id || 'unknown');
                var resolvedPlate = row && row.araclar && row.araclar.plaka || vehicleNames.get(id) || 'Eşleşmeyen araç';
                var item = groups.get(id) || { id: id, plate: resolvedPlate, current: { fuel: 0, maintenance: 0, policies: 0 }, previous: { fuel: 0, maintenance: 0, policies: 0 } };
                item[period][field] += number(row && row.toplam_tutar);
                if (resolvedPlate) item.plate = resolvedPlate;
                groups.set(id, item);
            });
        }
        add(current && current.fuel, 'fuel', 'current');
        add(current && current.maintenance, 'maintenance', 'current');
        add(current && current.policies, 'policies', 'current');
        add(previous && previous.fuel, 'fuel', 'previous');
        add(previous && previous.maintenance, 'maintenance', 'previous');
        add(previous && previous.policies, 'policies', 'previous');
        return Array.from(groups.values()).map(function (row) {
            row.current.total = row.current.fuel + row.current.maintenance + row.current.policies;
            row.previous.total = row.previous.fuel + row.previous.maintenance + row.previous.policies;
            row.change = percentChange(row.current.total, row.previous.total);
            return row;
        }).sort(function (a, b) { return b.current.total - a.current.total; });
    }

    function groupPayroll(currentRows, previousRows) {
        var groups = new Map();
        function add(rows, period) {
            (rows || []).forEach(function (row) {
                var id = String(row && row.sofor_id || row && row.soforler && row.soforler.ad_soyad || 'unknown');
                var item = groups.get(id) || { id: id, name: row && row.soforler && row.soforler.ad_soyad || 'Bilinmeyen', current: null, previous: null };
                item[period] = row;
                groups.set(id, item);
            });
        }
        add(currentRows, 'current');
        add(previousRows, 'previous');
        return Array.from(groups.values()).map(function (item) {
            item.currentPayment = item.current ? payrollValue(item.current) : 0;
            item.previousPayment = item.previous ? payrollValue(item.previous) : 0;
            item.change = percentChange(item.currentPayment, item.previousPayment);
            return item;
        }).sort(function (a, b) { return b.currentPayment - a.currentPayment; });
    }

    function groupCustomers(customers, currentRows, previousRows) {
        var names = new Map((customers || []).map(function (row) { return [String(row.id), row.ad || 'İsimsiz Müşteri']; }));
        var groups = new Map();
        function add(rows, period) {
            (rows || []).forEach(function (row) {
                var id = String(row && row.musteri_id || 'unknown');
                var item = groups.get(id) || { id: id, name: names.get(id) || 'Kayıt Dışı Müşteri', current: { shifts: 0, trips: 0, accrual: 0 }, previous: { shifts: 0, trips: 0, accrual: 0 } };
                item[period].shifts += number(row && row.vardiya);
                item[period].trips += number(row && row.tek);
                item[period].accrual += number(row && row.gunluk_ucret);
                groups.set(id, item);
            });
        }
        add(currentRows, 'current');
        add(previousRows, 'previous');
        return Array.from(groups.values()).map(function (item) {
            item.change = percentChange(item.current.accrual, item.previous.accrual);
            return item;
        }).sort(function (a, b) { return b.current.accrual - a.current.accrual; });
    }

    function serviceGross(row, definition) {
        row = row || {};
        definition = definition || {};
        return number(row.vardiya) * number(definition.vardiya_fiyat)
            + number(row.tek) * number(definition.tek_fiyat)
            + number(row.cikis_8) * number(definition.cikis_8_fiyat)
            + number(row.giris_2030) * number(definition.giris_2030_fiyat)
            + number(row.mesai) * number(definition.mesai_fiyat);
    }

    function groupCustomerServices(customers, vehicles, currentRows, previousRows, definitions, currentPeriod, previousPeriod, resolver) {
        var customerNames = new Map((customers || []).map(function (row) { return [String(row.id), row.ad || 'İsimsiz Müşteri']; }));
        var vehicleMap = new Map((vehicles || []).map(function (row) { return [String(row.id), row]; }));
        var groups = new Map();
        resolver = typeof resolver === 'function' ? resolver : function () { return null; };

        function add(rows, periodKey, periodValue) {
            (rows || []).forEach(function (row) {
                var customerId = String(row && row.musteri_id || 'unknown');
                var vehicleId = String(row && row.arac_id || 'unknown');
                var region = row && row.bolge || 'Manisa';
                var vehicle = vehicleMap.get(vehicleId) || {};
                var group = groups.get(customerId) || { id: customerId, name: customerNames.get(customerId) || 'Kayıt Dışı Müşteri', current: { shifts: 0, trips: 0, accrual: 0 }, previous: { shifts: 0, trips: 0, accrual: 0 }, details: new Map() };
                var detailKey = vehicleId + '|||' + region;
                var detail = group.details.get(detailKey) || {
                    key: detailKey, customerId: customerId, vehicleId: vehicleId, plate: vehicle.plaka || 'Eşleşmeyen araç', vehicleClass: vehicle.arac_sinifi || 'SINIFLANDIRILMAMIŞ', ownership: serviceOwnership(vehicle.mulkiyet_durumu), region: region,
                    current: { shifts: 0, trips: 0, other: 0, gross: 0, vardiyaPrice: 0, tekPrice: 0 },
                    previous: { shifts: 0, trips: 0, other: 0, gross: 0, vardiyaPrice: 0, tekPrice: 0 }
                };
                var definition = resolver(definitions || [], { musteriId: row.musteri_id, aracId: row.arac_id, bolge: region, donem: periodValue }) || {};
                var bucket = detail[periodKey];
                bucket.shifts += number(row.vardiya);
                bucket.trips += number(row.tek);
                bucket.other += number(row.cikis_8)+number(row.giris_2030)+number(row.mesai);
                bucket.gross += serviceGross(row, definition);
                bucket.vardiyaPrice = number(definition.vardiya_fiyat);
                bucket.tekPrice = number(definition.tek_fiyat);
                group[periodKey].shifts += number(row.vardiya);
                group[periodKey].trips += number(row.tek);
                group[periodKey].accrual += serviceGross(row, definition);
                group.details.set(detailKey, detail);
                groups.set(customerId, group);
            });
        }

        add(currentRows, 'current', currentPeriod);
        add(previousRows, 'previous', previousPeriod);
        return Array.from(groups.values()).map(function (group) {
            group.details = Array.from(group.details.values()).sort(function (a, b) { return String(a.plate).localeCompare(String(b.plate), 'tr'); });
            group.change = percentChange(group.current.accrual, group.previous.accrual);
            return group;
        }).sort(function (a, b) { return b.current.accrual - a.current.accrual; });
    }

    function mergeVehicleRevenue(expenseRows, customerRows, vehicles) {
        var groups = new Map((expenseRows || []).map(function (row) { return [String(row.id), row]; }));
        var vehicleMap = new Map((vehicles || []).map(function (row) { return [String(row.id), row]; }));
        (customerRows || []).forEach(function (customer) {
            (customer.details || []).forEach(function (detail) {
                var id = String(detail.vehicleId);
                var vehicle = vehicleMap.get(id) || {};
                var item = groups.get(id) || {
                    id: id, plate: vehicle.plaka || detail.plate || 'Eşleşmeyen araç',
                    current: { fuel: 0, maintenance: 0, policies: 0, total: 0 },
                    previous: { fuel: 0, maintenance: 0, policies: 0, total: 0 }
                };
                item.vehicleClass = vehicle.arac_sinifi || detail.vehicleClass || 'SINIFLANDIRILMAMIŞ';
                item.current.revenue = number(item.current.revenue) + number(detail.current.gross);
                item.previous.revenue = number(item.previous.revenue) + number(detail.previous.gross);
                groups.set(id, item);
            });
        });
        return Array.from(groups.values()).map(function (row) {
            row.current.revenue = number(row.current.revenue);
            row.previous.revenue = number(row.previous.revenue);
            row.current.net = row.current.revenue - number(row.current.total);
            row.previous.net = row.previous.revenue - number(row.previous.total);
            row.netChange = percentChange(row.current.net, row.previous.net);
            return row;
        }).sort(function (a, b) { return b.current.revenue - a.current.revenue; });
    }

    function serviceOwnership(value) {
        var normalized=String(value || '').trim().toLocaleUpperCase('tr-TR');
        return normalized==='ÖZMAL'||normalized==='TAŞERON'?normalized:'MÜLKİYET BELİRSİZ';
    }
    function groupServiceOwnership(details, period) {
        period=period==='previous'?'previous':'current';
        var groups=new Map(['ÖZMAL','TAŞERON'].map(function(key){return [key,{ownership:key,shifts:0,trips:0,other:0,gross:0,details:[]}];}));
        (details || []).forEach(function(detail){
            var key=serviceOwnership(detail.ownership);
            var item=groups.get(key)||{ownership:key,shifts:0,trips:0,other:0,gross:0,details:[]};
            var bucket=detail[period]||{};
            item.shifts+=number(bucket.shifts);item.trips+=number(bucket.trips);item.other+=number(bucket.other);item.gross+=number(bucket.gross);item.details.push(detail);groups.set(key,item);
        });
        return Array.from(groups.values());
    }

    function groupServiceClasses(details) {
        var groups = new Map();
        (details || []).forEach(function(detail) {
            var current = detail.current;
            var key = JSON.stringify([serviceOwnership(detail.ownership), detail.vehicleClass, current.vardiyaPrice, current.tekPrice]);
            var group = groups.get(key) || {vehicleClass:detail.vehicleClass, ownership:serviceOwnership(detail.ownership), shifts:0, trips:0, other:0, gross:0, vardiyaPrice:current.vardiyaPrice, tekPrice:current.tekPrice, regions:new Set(), vehicles:new Set()};
            group.shifts += number(current.shifts); group.trips += number(current.trips); group.other += number(current.other); group.gross += number(current.gross);
            group.regions.add(detail.region); group.vehicles.add(detail.vehicleId);
            groups.set(key, group);
        });
        return Array.from(groups.values());
    }

    function groupCaris(caris, currentInvoices, currentPayments, previousInvoices, previousPayments) {
        var groups = new Map((caris || []).map(function (row) { return [String(row.id), { id: String(row.id), name: row.unvan, type: row.tur || 'Cari', currentDebt: 0, currentPayment: 0, previousDebt: 0, previousPayment: 0 }]; }));
        function add(rows, field) {
            (rows || []).forEach(function (row) {
                var item = groups.get(String(row && row.cari_id));
                if (item) item[field] += number(row && (row.toplam_tutar != null ? row.toplam_tutar : row.tutar));
            });
        }
        add(currentInvoices, 'currentDebt'); add(currentPayments, 'currentPayment');
        add(previousInvoices, 'previousDebt'); add(previousPayments, 'previousPayment');
        return Array.from(groups.values()).map(function (item) {
            item.currentNet = item.currentDebt - item.currentPayment;
            item.previousNet = item.previousDebt - item.previousPayment;
            item.change = percentChange(Math.abs(item.currentNet), Math.abs(item.previousNet));
            return item;
        }).filter(function (item) { return item.currentDebt || item.currentPayment || item.previousDebt || item.previousPayment; })
            .sort(function (a, b) { return Math.abs(b.currentNet) - Math.abs(a.currentNet); });
    }

    return {
        number: number,
        periodBounds: periodBounds,
        percentChange: percentChange,
        payrollValue: payrollValue,
        summarize: summarize,
        groupVehicles: groupVehicles,
        groupPayroll: groupPayroll,
        groupCustomers: groupCustomers,
        serviceGross: serviceGross,
        groupCustomerServices: groupCustomerServices,
        mergeVehicleRevenue: mergeVehicleRevenue,
        groupServiceClasses: groupServiceClasses,
        groupServiceOwnership: groupServiceOwnership,
        groupCaris: groupCaris
    };
});
