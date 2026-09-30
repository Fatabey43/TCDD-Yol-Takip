import * as XLSX from 'xlsx';
import { RailwayPoint, WorkLog } from '../types.ts';

/**
 * TCDD Resmi Rapor Üretici (Excel & Yazdırılabilir / PDF Uyumlu HTML)
 * 1. Menfez Envanter & Muayene Raporu
 * 2. Hemzemin Geçit Denetim Föyü
 * 3. Yapılan Saha İşleri & Bakım-Onarım Raporu
 * 4. Genel Hat Envanter Listesi
 */

export interface ReportFilterOptions {
  reportType: 'culvert' | 'crossing' | 'workLog' | 'all';
  selectedLine?: string;
  startDate?: string;
  endDate?: string;
}

export function exportRailwayReportToExcel(
  points: RailwayPoint[],
  options: ReportFilterOptions
) {
  const wb = XLSX.utils.book_new();

  // 1. Culverts Sheet
  if (options.reportType === 'culvert' || options.reportType === 'all') {
    const culverts = points.filter(p => p.category === 'culvert' || p.culvert);
    const culvertRows = culverts.map((c, idx) => ({
      'Sıra No': c.culvert?.siraNo || idx + 1,
      'Hattı': c.culvert?.hatti || c.lineName || 'Esk.-Konya',
      'Mihver KM': c.culvert?.mihverKlm || c.kmValue || c.title,
      'Cinsi': c.culvert?.cinsi || '-',
      'Açıklık - Serbest (m)': c.culvert?.aciklikSerbest || '-',
      'Açıklık - Mesnet': c.culvert?.aciklikMesnet || '-',
      'Debuşe Yüksekliği (m)': c.culvert?.debuseYuksekligi || '-',
      'Yapım Yılı': c.culvert?.yapimYili || '-',
      'Dingil Basıncı (Ton)': c.culvert?.dingilBasinci || '22,5',
      'Bakım Şefliği': c.culvert?.bakimSefligi || '712 YOL BAKIM ŞEFLİĞİ',
      'Enlem (Lat)': c.lat,
      'Boylam (Lng)': c.lng,
      'Açıklama / Not': c.description || '',
      'Fotoğraf Sayısı': c.photos?.length || 0,
    }));

    const wsCulverts = XLSX.utils.json_to_sheet(culvertRows);
    XLSX.utils.book_append_sheet(wb, wsCulverts, 'Menfezler');
  }

  // 2. Crossings Sheet
  if (options.reportType === 'crossing' || options.reportType === 'all') {
    const crossings = points.filter(p => p.category === 'crossing' || p.levelCrossing);
    const crossingRows = crossings.map((c, idx) => ({
      'Sıra No': idx + 1,
      'Geçit Adı / KM': c.title,
      'Mihver KM': c.kmValue || '',
      'Hattı': c.lineName,
      'Geçit Tipi': c.levelCrossing?.crossingType || '-',
      'Kaplama Cinsi': c.levelCrossing?.surfaceType || '-',
      'Günlük Taşıt Sayısı': c.levelCrossing?.dailyVehicleCount || '-',
      'Günlük Tren Sayısı': c.levelCrossing?.dailyTrainCount || '-',
      'Yol Genişliği (m)': c.levelCrossing?.clearanceWidth || '-',
      'Kestiği Hat Adedi': c.levelCrossing?.intersectedTrackCount || '-',
      'Nereleri Bağladığı': c.levelCrossing?.nereleriBagladigi || '-',
      'Bulunduğu İl': c.levelCrossing?.bulunduguIl || '-',
      'Şube Şefliği': c.levelCrossing?.subeSefligi || '71 Kütahya',
      'Enlem (Lat)': c.lat,
      'Boylam (Lng)': c.lng,
    }));

    const wsCrossings = XLSX.utils.json_to_sheet(crossingRows);
    XLSX.utils.book_append_sheet(wb, wsCrossings, 'Hemzemin Geçitler');
  }

  // 3. Work Logs (Yapılan İşler) Sheet
  if (options.reportType === 'workLog' || options.reportType === 'all') {
    const workRows: any[] = [];
    points.forEach(p => {
      const logs = p.workLogs || [];
      logs.forEach(log => {
        workRows.push({
          'İş No': log.id,
          'Nokta / Mevki': p.title,
          'KM': p.kmValue,
          'Hat': p.lineName,
          'İş Başlığı': log.title,
          'İş Türü': log.workType,
          'Tarih': log.performedAt,
          'Ekip / Personel': log.performedBy,
          'Durum': log.status,
          'Personel Sayısı': log.crewCount || '-',
          'Kullanılan Malzeme': log.materialsUsed || '-',
          'İş Detayı / Açıklama': log.description,
          'Fotoğraf Adedi': log.photos?.length || 0,
        });
      });
    });

    if (workRows.length === 0) {
      workRows.push({
        'Nokta / Mevki': 'Henüz kayıtlı yapılan iş bulunamadı',
        'İş Detayı / Açıklama': 'Nokta detayından "Yapılan İş Ekle" diyerek iş kayıtları oluşturabilirsiniz.',
      });
    }

    const wsWork = XLSX.utils.json_to_sheet(workRows);
    XLSX.utils.book_append_sheet(wb, wsWork, 'Yapılan Saha İşleri');
  }

  // 4. All Points Inventory
  if (options.reportType === 'all') {
    const allRows = points.map((p, idx) => ({
      'No': idx + 1,
      'Başlık': p.title,
      'KM': p.kmValue,
      'Hattı': p.lineName,
      'Kategori': p.category,
      'Mevki': p.locationDesc || '-',
      'Enlem': p.lat,
      'Boylam': p.lng,
      'Fotoğraf': p.photos?.length || 0,
      'Notlar': p.notes?.length || 0,
      'Açıklama': p.description || '',
    }));
    const wsAll = XLSX.utils.json_to_sheet(allRows);
    XLSX.utils.book_append_sheet(wb, wsAll, 'Tüm Noktalar');
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `TCDD_712_Saha_Raporu_${options.reportType}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Generates and opens an official printable PDF-ready report in a new tab/window
 */
export function openPrintableRailwayReport(
  points: RailwayPoint[],
  options: ReportFilterOptions
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const now = new Date().toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let reportTitle = 'TCDD SAHA FAALİYET VE TEFTİŞ RAPORU';
  if (options.reportType === 'culvert') reportTitle = '712 YOL BAKIM ŞEFLİĞİ MENFEZ ENVANTER VE TEFTİŞ RAPORU';
  if (options.reportType === 'crossing') reportTitle = 'HEMZEMİN GEÇİT GÜVENLİK VE TEFTİŞ FORMU';
  if (options.reportType === 'workLog') reportTitle = 'YOL BAKIM ŞEFLİĞİ SAHA İŞ VE BAKIM FAALİYET RAPORU';

  let tableHtml = '';

  if (options.reportType === 'culvert') {
    const culverts = points.filter(p => p.category === 'culvert' || p.culvert);
    tableHtml = `
      <table class="report-table">
        <thead>
          <tr>
            <th>Sıra</th>
            <th>Hattı</th>
            <th>Mihver KM</th>
            <th>Cinsi</th>
            <th>Serbest Açıklık (m)</th>
            <th>Mesnet</th>
            <th>Debuşe Yük. (m)</th>
            <th>Yapım Yılı</th>
            <th>Basınç (Ton)</th>
            <th>Foto</th>
          </tr>
        </thead>
        <tbody>
          ${culverts.map((c, i) => `
            <tr>
              <td class="text-center font-bold">${c.culvert?.siraNo || i + 1}</td>
              <td>${c.culvert?.hatti || c.lineName || 'Esk.-Konya'}</td>
              <td class="font-bold text-center">${c.culvert?.mihverKlm || c.kmValue || c.title}</td>
              <td>${c.culvert?.cinsi || '-'}</td>
              <td class="text-center">${c.culvert?.aciklikSerbest || '-'}</td>
              <td class="text-center">${c.culvert?.aciklikMesnet || '1'}</td>
              <td class="text-center">${c.culvert?.debuseYuksekligi || '-'}</td>
              <td class="text-center">${c.culvert?.yapimYili || '-'}</td>
              <td class="text-center">${c.culvert?.dingilBasinci || '22,5'}</td>
              <td class="text-center">${c.photos?.length ? `📷 ${c.photos.length}` : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else if (options.reportType === 'workLog') {
    const allLogs: { point: RailwayPoint; log: WorkLog }[] = [];
    points.forEach(p => {
      (p.workLogs || []).forEach(log => allLogs.push({ point: p, log }));
    });

    tableHtml = `
      <table class="report-table">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Mevki / KM</th>
            <th>İş Başlığı</th>
            <th>İş Türü</th>
            <th>Ekip / Personel</th>
            <th>Durum</th>
            <th>Açıklama / Malzeme</th>
          </tr>
        </thead>
        <tbody>
          ${allLogs.length > 0 ? allLogs.map(item => `
            <tr>
              <td>${item.log.performedAt}</td>
              <td class="font-bold">${item.point.title} (${item.point.kmValue || '-'})</td>
              <td class="font-bold text-blue-800">${item.log.title}</td>
              <td>${item.log.workType}</td>
              <td>${item.log.performedBy}</td>
              <td><span class="badge badge-${item.log.status}">${item.log.status}</span></td>
              <td>
                <div>${item.log.description}</div>
                ${item.log.materialsUsed ? `<div class="subtext">Malzeme: ${item.log.materialsUsed}</div>` : ''}
              </td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="7" class="text-center py-4">Kayıtlı yapılan iş kaydı bulunamadı.</td>
            </tr>
          `}
        </tbody>
      </table>
    `;
  } else if (options.reportType === 'crossing') {
    const crossings = points.filter(p => p.category === 'crossing' || p.levelCrossing);
    tableHtml = `
      <table class="report-table">
        <thead>
          <tr>
            <th>Sıra</th>
            <th>Geçit Adı / Tanım</th>
            <th>KM</th>
            <th>Hattı</th>
            <th>Geçit Tipi</th>
            <th>Kaplama Cinsi</th>
            <th>Taşıt / Gün</th>
            <th>Tren / Gün</th>
            <th>Genişlik (m)</th>
            <th>Hat Adedi</th>
            <th>Güzergah (Bağlantı)</th>
            <th>Foto</th>
          </tr>
        </thead>
        <tbody>
          ${crossings.map((c, idx) => `
            <tr>
              <td class="text-center font-bold">${idx + 1}</td>
              <td class="font-bold text-amber-900">${c.title}</td>
              <td class="text-center font-bold font-mono">${c.kmValue || '-'}</td>
              <td>${c.lineName || 'Esk.-Konya'}</td>
              <td class="font-semibold text-blue-900">${c.levelCrossing?.crossingType || '-'}</td>
              <td>${c.levelCrossing?.surfaceType || '-'}</td>
              <td class="text-center">${c.levelCrossing?.dailyVehicleCount || '-'}</td>
              <td class="text-center">${c.levelCrossing?.dailyTrainCount || '-'}</td>
              <td class="text-center">${c.levelCrossing?.clearanceWidth || '-'}</td>
              <td class="text-center">${c.levelCrossing?.intersectedTrackCount || '1'}</td>
              <td>${c.levelCrossing?.nereleriBagladigi || '-'}</td>
              <td class="text-center font-bold">${c.photos?.length ? `📷 ${c.photos.length}` : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    // General all points
    const filtered = points;

    tableHtml = `
      <table class="report-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Başlık / Tanım</th>
            <th>KM</th>
            <th>Hat Adı</th>
            <th>Kategori</th>
            <th>Koordinat (Lat, Lng)</th>
            <th>Açıklama</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((p, idx) => `
            <tr>
              <td class="text-center">${idx + 1}</td>
              <td class="font-bold">${p.title}</td>
              <td class="text-center font-bold">${p.kmValue || '-'}</td>
              <td>${p.lineName}</td>
              <td>${p.category}</td>
              <td class="text-center text-mono">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</td>
              <td>${p.description || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>${reportTitle}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 20px;
          color: #0f172a;
          background: #ffffff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .logo-box h2 {
          margin: 0;
          color: #0369a1;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        .logo-box h3 {
          margin: 2px 0 0 0;
          color: #475569;
          font-size: 13px;
          font-weight: 600;
        }
        .meta-box {
          text-align: right;
          font-size: 11px;
          color: #64748b;
        }
        .title-bar {
          background: #f1f5f9;
          border-left: 4px solid #0284c7;
          padding: 8px 12px;
          margin-bottom: 14px;
        }
        .title-bar h1 {
          margin: 0;
          font-size: 15px;
          color: #0f172a;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .report-table th, .report-table td {
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          text-align: left;
        }
        .report-table th {
          background: #f8fafc;
          color: #334155;
          font-weight: 700;
        }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .text-mono { font-family: monospace; font-size: 10px; }
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .badge-tamamlandi { background: #dcfce7; color: #166534; }
        .badge-devam_ediyor { background: #fef9c3; color: #854d0e; }
        .badge-planlandi { background: #e0f2fe; color: #075985; }
        .subtext { font-size: 10px; color: #64748b; margin-top: 2px; }
        .footer {
          margin-top: 20px;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 8px;
        }
        .print-btn-bar {
          margin-bottom: 15px;
        }
        .print-btn {
          background: #0284c7;
          color: white;
          border: none;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: bold;
          border-radius: 6px;
          cursor: pointer;
        }
        @media print {
          .print-btn-bar { display: none; }
          body { margin: 0; padding: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-bar">
        <button class="print-btn" onclick="window.print()">🖨️ Yazdır / PDF Olarak Kaydet</button>
      </div>
      <div class="header">
        <div class="logo-box">
          <h2>T.C. DEVLET DEMİRYOLLARI İŞLETMESİ GENEL MÜDÜRLÜĞÜ</h2>
          <h3>712. YOL BAKIM ŞEFLİĞİ (ALAYUNT - KÜTAHYA - ÇÖĞÜRLER BÖLGESİ)</h3>
        </div>
        <div class="meta-box">
          <div><strong>Rapor Tarihi:</strong> ${now}</div>
          <div><strong>Sistem:</strong> TCDD Saha Takip & Harita Portalı</div>
        </div>
      </div>
      <div class="title-bar">
        <h1>${reportTitle}</h1>
      </div>
      ${tableHtml}
      <div class="footer">
        <div>Bu belge TCDD 712. Yol Bakım Şefliği Sayısal Saha Bilgi Sistemi tarafından üretilmiştir.</div>
        <div>Sayfa 1</div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(fullHtml);
  printWindow.document.close();
}
