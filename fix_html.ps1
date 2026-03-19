$file = "c:\Users\hhasa\OneDrive\Desktop\Filo-ERP\Filo-ERP\filoyonetim.html"
$lines = [System.IO.File]::ReadAllLines($file, [System.Text.Encoding]::UTF8)
Write-Host "Total lines: $($lines.Length)"

# Find the index of the line containing 'taksitler-tbody'
$taksitlerIdx = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'taksitler-tbody') {
        $taksitlerIdx = $i
        Write-Host "Found taksitler-tbody at 0-indexed line: $i (line number: $($i+1))"
        break
    }
}

if ($taksitlerIdx -eq -1) {
    Write-Error "taksitler-tbody not found!"
    exit 1
}

# The closing sequence is:
# taksitlerIdx+0 = <tbody id="taksitler-tbody">
# taksitlerIdx+1 = <tr>
# taksitlerIdx+2 = <td ...>
# taksitlerIdx+3 = yükleniyor...</td>
# taksitlerIdx+4 = </tr>
# taksitlerIdx+5 = </tbody>
# taksitlerIdx+6 = </table>
# taksitlerIdx+7 = </div>  (overflow-x-auto div)
# taksitlerIdx+8 = </div>  (content-taksitler div)
# ^^^ This is the insertion point (after index taksitlerIdx+8)

$insertAfter = $taksitlerIdx + 8
Write-Host "Will insert after line $($insertAfter+1): $($lines[$insertAfter])"

$newHTML = @"

                    <!-- Personel Maaş & Bordro -->
                    <div id="content-maaslar" class="hidden p-6">
                        <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                            <h3 class="text-lg font-bold">Personel Maaş &amp; Finansal Durum</h3>
                            <button onclick="openModal('Yeni Finans İşlemi')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2">
                                <i data-lucide="plus" class="w-4 h-4"></i>
                                Yeni Ödeme / Avans
                            </button>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="premium-table">
                                <thead>
                                    <tr>
                                        <th>Personel (Şoför) Adı</th>
                                        <th>Aylık Maaş (₺)</th>
                                        <th>Ödenen Toplam (₺)</th>
                                        <th>Kesintiler (₺)</th>
                                        <th class="text-right">Kalan Bakiye (₺)</th>
                                    </tr>
                                </thead>
                                <tbody id="maaslar-tbody">
                                    <tr>
                                        <td colspan="5" class="py-12 text-center text-gray-500 italic">Veriler yükleniyor...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Kredi Kartları -->
                    <div id="content-kredi-kartlari" class="hidden p-6">
                        <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                            <h3 class="text-lg font-bold">Şirket Kredi Kartları</h3>
                            <div class="flex gap-2">
                                <button onclick="openModal('Yeni Kart İşlemi')" class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-xl text-sm transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2">
                                    <i data-lucide="receipt" class="w-4 h-4"></i>
                                    Harcama Ekle
                                </button>
                                <button onclick="openModal('Yeni Kredi Kartı')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2">
                                    <i data-lucide="credit-card" class="w-4 h-4"></i>
                                    Kart Ekle
                                </button>
                            </div>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="premium-table">
                                <thead>
                                    <tr>
                                        <th>Kart Adı / Banka</th>
                                        <th>Limit (₺)</th>
                                        <th>Kullanılan (₺)</th>
                                        <th>Kullanılabilir (₺)</th>
                                        <th class="text-right">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody id="kredi-kartlari-tbody">
                                    <tr>
                                        <td colspan="5" class="py-12 text-center text-gray-500 italic">Veriler yükleniyor...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
"@

$newLines = $newHTML -split "`n"

$result = [System.Collections.Generic.List[string]]::new()
for ($i = 0; $i -le $insertAfter; $i++) {
    $result.Add($lines[$i])
}
foreach ($nl in $newLines) {
    $result.Add($nl)
}
for ($i = $insertAfter + 1; $i -lt $lines.Length; $i++) {
    $result.Add($lines[$i])
}

[System.IO.File]::WriteAllLines($file, $result, [System.Text.Encoding]::UTF8)
Write-Host "Done! New total lines: $($result.Count)"
