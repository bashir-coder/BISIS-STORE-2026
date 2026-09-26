const fs = require('fs');
const path = require('path');
const file = 'frontend/src/i18n-fallback.ts';
let content = fs.readFileSync(file, 'utf8');

function insertAfterLine(text, searchStr, insertText) {
    const idx = text.indexOf(searchStr);
    if (idx === -1) {
        console.log('NOT FOUND: ' + searchStr.substring(0, 50));
        return text;
    }
    const endOfLine = text.indexOf('\n', idx) + 1;
    return text.slice(0, endOfLine) + insertText + text.slice(endOfLine);
}

// 1. Arabic block: Add lab.payment.point2, point3, provider after lab.payment.point1
// Check if they already exist
if (!content.includes('"lab.payment.point2"')) {
    content = insertAfterLine(content, '"lab.payment.point1":',
        '      "lab.payment.point2": "المسار الحالي للعملات المشفرة يستخدم USDC على BSC.",\n' +
        '      "lab.payment.point3": "حالة الدفع تعود إلى النظام عبر مسار NOWPayments.",\n' +
        '      "lab.payment.provider": "بنية تحتية للدفع",\n');
    console.log('AR: lab.payment.point2/3/provider added');
} else {
    console.log('AR: already has point2');
}

// 2. English block: Add footer.collapse, footer.expand after footer.cta_title
// Only add in the EN (English) block - find the right occurrence
// The EN block has: "footer.cta_title": "Ready to turn your idea into practical steps?",
const enFooterCtaTitle = '"footer.cta_title": "Ready to turn your idea into practical steps?",';
if (!content.includes('"footer.collapse": "Collapse footer"')) {
    // Find the EN footer.cta_title
    const idx = content.indexOf(enFooterCtaTitle);
    if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx) + 1;
        const insert = '      "footer.collapse": "Collapse footer",\n' +
            '      "footer.expand": "Expand footer",\n';
        content = content.slice(0, endOfLine) + insert + content.slice(endOfLine);
        console.log('EN: footer.collapse/expand added');
    } else {
        console.log('EN: footer.cta_title not found');
    }
}

// 3. Turkish block: Add footer.collapse, footer.expand after footer.cta_title
const trFooterCtaTitle = '"footer.cta_title": "Fikrinizi uygulanabilir adımlara dönüştürmeye hazır mısınız?",';
if (!content.includes('"footer.collapse": "Altbilgiyu daralt"')) {
    const idx = content.indexOf(trFooterCtaTitle);
    if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx) + 1;
        const insert = '      "footer.collapse": "Altbilgiyu Daralt",\n' +
            '      "footer.expand": "Altbilgiyu Genişlet",\n';
        content = content.slice(0, endOfLine) + insert + content.slice(endOfLine);
        console.log('TR: footer.collapse/expand added');
    } else {
        console.log('TR: footer.cta_title not found');
    }
}

// 4. English block: Add lab.payment.* keys (all except provider which exists)
const enPaymentProvider = '"lab.payment.provider": "Payment infrastructure"';
if (!content.includes('"lab.payment.available": "Current core route"')) {
    const idx = content.indexOf(enPaymentProvider);
    if (idx !== -1) {
        const lineStart = content.lastIndexOf('\n', idx) + 1;
        const indent = content.substring(lineStart, idx).match(/^\s*/)[0];
        const insert = indent + '"lab.packages.popular": "Most popular",\n' +
            indent + '"lab.payment.available": "Current core route",\n' +
            indent + '"lab.payment.cta": "Go to payment",\n' +
            indent + '"lab.payment.description": "Pay securely through NOWPayments using USDC on BNB Smart Chain. Your order status updates automatically once confirmed.",\n' +
            indent + '"lab.payment.eyebrow": "Payment",\n' +
            indent + '"lab.payment.point1": "Core prices are displayed in USD.",\n' +
            indent + '"lab.payment.point2": "The current crypto route uses USDC on BSC.",\n' +
            indent + '"lab.payment.point3": "Payment status returns to the system via NOWPayments.",\n';
        content = content.slice(0, lineStart) + insert + content.slice(lineStart);
        console.log('EN: lab.payment.* + lab.packages.popular added');
    } else {
        console.log('EN: lab.payment.provider not found');
    }
}

// 5. English block: Add lab.payment.title after lab.payment.provider
if (!content.includes('"lab.payment.title": "Clear payment, order-linked status"')) {
    const idx = content.indexOf(enPaymentProvider);
    if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx) + 1;
        const indent = content.substring(content.lastIndexOf('\n', idx) + 1, idx).match(/^\s*/)[0];
        const insert = indent + '"lab.payment.title": "Clear payment, order-linked status",\n';
        content = content.slice(0, endOfLine) + insert + content.slice(endOfLine);
        console.log('EN: lab.payment.title added');
    }
}

// 6. Turkish block: Add lab.* keys after hero.cta2 (before invoices.*)
const trHeroCta2 = '"hero.cta2": "Paketleri gör",';
if (!content.includes('"lab.packages.popular": "En popüler"')) {
    const idx = content.indexOf(trHeroCta2);
    if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx) + 1;
        const indent = '      ';
        const insert =
            indent + '"lab.packages.popular": "En popüler",\n' +
            indent + '"lab.payment.available": "Mevcut temel yol",\n' +
            indent + '"lab.payment.cta": "Ödemeye geç",\n' +
            indent + '"lab.payment.description": "NOWPayments üzerinden BNB Smart Chain üzerindeki USDC ile güvenle ödeme yapın. Sipariş durumunuz, onaylandıktan sonra otomatik olarak güncellenir.",\n' +
            indent + '"lab.payment.eyebrow": "Ödeme",\n' +
            indent + '"lab.payment.point1": "Temel fiyatlar USD olarak gösterilir.",\n' +
            indent + '"lab.payment.point2": "Mevcut kripto yolu USDC/BSC kullanır.",\n' +
            indent + '"lab.payment.point3": "Ödeme durumu, NOWPayments yoluyla sisteme geri döner.",\n' +
            indent + '"lab.payment.provider": "Ödeme altyapısı",\n' +
            indent + '"lab.payment.title": "Net ödeme, siparişle bağlantılı durum",\n';
        content = content.slice(0, endOfLine) + insert + content.slice(endOfLine);
        console.log('TR: lab.* keys added');
    } else {
        console.log('TR: hero.cta2 not found');
    }
}

fs.writeFileSync(file, content, 'utf8');
console.log('File saved. New line count:', content.split('\n').length);
