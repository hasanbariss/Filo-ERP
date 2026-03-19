
# Use UTF-8 encoding explicitly
$file = "c:\Users\hhasa\OneDrive\Desktop\Filo-ERP\Filo-ERP\filoyonetim.html"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# Find where content-kredi-kartlari starts and ends, then clean everything between taksitler div close and raporlar module
# The structure we want after taksitler section:
$correctBlock = @"

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
                </div>
            </div>
"@

# Remove everything from after the taksitler div close to the module-raporlar start, then replace with correct block
# Pattern: find "</div>`r`n                </div>`r`n            </div>`r`n`r`n                        <!-- 6. RAPORLAR" 
# or any mess between taksitler-tbody area and raporlar module

# Strategy: use a regex to remove from id=taksitler-tbody close to <!-- 6. RAPORLAR and put clean content
$raporStart = "                        <!-- 6. RAPORLAR MODULU -->"

# Find aylık tutar cell then everything until raporlar
$taksitEnd = "            </div>`r`n`r`n                        <!-- 6. RAPORLAR MODULU -->"

# Let's use a broad regex approach
$pattern = "(?s)(id=""taksitler-tbody"">.*?</div>\r?\n            </div>\r?\n).*?(                        <!-- 6\. RAPORLAR)"
$replacement = "`$1$correctBlock`r`n`$2"

if ($content -match $pattern) {
    $newContent = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, $replacement)
    [System.IO.File]::WriteAllText($file, $newContent, [System.Text.Encoding]::UTF8)
    Write-Host "SUCCESS: Content replaced correctly"
    # Verify
    if ([System.IO.File]::ReadAllText($file) -match "openModal\('Yeni Kredi Kartı'\)") {
        Write-Host "VERIFIED: Yeni Kredi Kartı button found correctly"
    }
} else {
    Write-Host "PATTERN NOT FOUND - trying simpler approach"
    # Simpler: find first occurrence of content-maaslar and content-kredi-kartlari and fix them
    $badPattern = "(?s)(content-maaslar.*?content-kredi-kartlari.*?kredi-kartlari-tbody.*?</div>\s*</div>\s*</div>\s*</div>)"
    if ($content -match $badPattern) {
        Write-Host "Found bad block, replacing..."
    } else {
        Write-Host "Could not find pattern"
    }
}
