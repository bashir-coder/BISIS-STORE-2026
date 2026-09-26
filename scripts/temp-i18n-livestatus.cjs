const fs = require('fs');
const file = 'frontend/src/i18n-fallback.ts';
let content = fs.readFileSync(file, 'utf8');
let changed = 0;

function insertAfter(text, marker, insertLines) {
    const idx = text.indexOf(marker);
    if (idx === -1) {
        console.log('NOT FOUND: ' + marker.substring(0, 60));
        return text;
    }
    const endOfLine = text.indexOf('\n', idx) + 1;
    // Get the indentation from the marker line
    const lineStart = text.lastIndexOf('\n', idx) + 1;
    const indent = text.substring(lineStart, idx).match(/^\s*/)[0];
    const insert = indent + insertLines.join('\n').map(l => indent + l).join('\n') + '\n';
    return text.slice(0, endOfLine) + insert + text.slice(endOfLine);
}

// Arabic block: insert livestatus keys between lifeplan.title and nav.about
const arLifeplanTitle = '"lifeplan.title": "The Life Plan™",';
if (!content.includes('"livestatus.system_health": "صحة النظام"')) {
    const arKeys = [
        '"livestatus.dispatch": "طابور التوزيع",',
        '"livestatus.dispatch_speed": "< 15m فوري",',
        '"livestatus.escrow": "أمان الحملات",',
        '"livestatus.crypto": "USDC على BSC",',
        '"livestatus.delivery": "توصيل عالمي",',
        '"livestatus.languages": "ع · تر · إ",',
        '"livestatus.operational": "تشغيل",',
        '"livestatus.live": "مباشر",',
        '"livestatus.secure": "آمن",',
        '"livestatus.system_health": "صحة النظام"',
    ];
    // Find the AR lifeplan.title
    const idx = content.indexOf(arLifeplanTitle);
    if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx) + 1;
        content = content.slice(0, endOfLine) + arKeys.map(k => '      ' + k).join('\n') + '\n' + content.slice(endOfLine);
        changed++;
        console.log('AR: livestatus keys added');
    }
}

// English block: insert livestatus keys between lifeplan.title and nav.about
const enLifeplanTitle = '"lifeplan.title": "The Life Plan™",';
if (!content.includes('"livestatus.system_health": "System Health"')) {
    const idx = content.indexOf(enLifeplanTitle);
    if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx) + 1;
        const enKeys = [
            '"livestatus.dispatch": "Dispatch Queue",',
            '"livestatus.dispatch_speed": "< 15m Instant",',
            '"livestatus.escrow": "Escrow Security",',
            '"livestatus.crypto": "USDC BSC",',
            '"livestatus.delivery": "Global Delivery",',
            '"livestatus.languages": "AR · TR · EN",',
            '"livestatus.operational": "Operational",',
            '"livestatus.live": "Live",',
            '"livestatus.secure": "Secure",',
            '"livestatus.system_health": "System Health"',
        ];
        content = content.slice(0, endOfLine) + enKeys.map(k => '      ' + k).join('\n') + '\n' + content.slice(endOfLine);
        changed++;
        console.log('EN: livestatus keys added');
    }
}

// Turkish block: insert livestatus keys between lifeplan.title and nav.about
// The Turkish lifeplan.title also says "The Life Plan™"
if (!content.includes('"livestatus.system_health": "Sistem Durumu"')) {
    // Find the TR lifeplan.title - it's after "Paketi görüntüle"
    const trLifeplanTitle = '"lifeplan.title": "The Life Plan™",';
    // We need the SECOND or THIRD occurrence (TR block)
    const occurrences = [];
    let searchIdx = 0;
    while (true) {
        const found = content.indexOf(trLifeplanTitle, searchIdx);
        if (found === -1) break;
        occurrences.push(found);
        searchIdx = found + 1;
    }
    console.log('Found lifeplan.title at positions:', occurrences.length);
    
    if (occurrences.length >= 3) {
        const idx = occurrences[2]; // Third occurrence = TR block
        const endOfLine = content.indexOf('\n', idx) + 1;
        const trKeys = [
            '"livestatus.dispatch": "Dağıtım Kuyruğu",',
            '"livestatus.dispatch_speed": "< 15dk Anlık",',
            '"livestatus.escrow": "Teminat Güvenliği",',
            '"livestatus.crypto": "USDC BSC",',
            '"livestatus.delivery": "Küresel Teslimat",',
            '"livestatus.languages": "Arapça · Türkçe · İngilizce",',
            '"livestatus.operational": "Çalışıyor",',
            '"livestatus.live": "Canlı",',
            '"livestatus.secure": "Güvenli",',
            '"livestatus.system_health": "Sistem Durumu"',
        ];
        content = content.slice(0, endOfLine) + trKeys.map(k => '      ' + k).join('\n') + '\n' + content.slice(endOfLine);
        changed++;
        console.log('TR: livestatus keys added');
    } else {
        console.log('TR: lifeplan.title not found at expected position');
    }
}

fs.writeFileSync(file, content, 'utf8');
console.log('Total changes:', changed, 'New line count:', content.split('\n').length);
