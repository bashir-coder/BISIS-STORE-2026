const fs = require('fs');
const file = 'frontend/src/i18n-fallback.ts';
let content = fs.readFileSync(file, 'utf8');

// Helper: insert text after a specific line matching a search string
function insertAfterMarker(text, searchStr, newLines, blockLabel) {
    if (text.includes(newLines[0].split(':')[0].trim() + '":')) {
        console.log(blockLabel + ': already has this key, skipping');
        return text;
    }
    const idx = text.indexOf(searchStr);
    if (idx === -1) {
        console.log(blockLabel + ': marker not found: ' + searchStr.substring(0, 60));
        return text;
    }
    const endOfLine = text.indexOf('\n', idx) + 1;
    const indent = '      ';
    const insert = newLines.map(l => indent + l).join('\n') + '\n';
    // Only insert if the next line doesn't already have the key
    if (content.substring(endOfLine).startsWith(indent + newLines[0])) {
        console.log(blockLabel + ': already inserted');
        return text;
    }
    return text.slice(0, endOfLine) + insert + text.slice(endOfLine);
}

// 1. Add lab.payment.security to all 3 blocks
// Arabic: after lab.payment.title, before lab.process.1.title
// English: after lab.payment.title (we added it), need to check
// Turkish: after lab.payment.title (we added it), need to check

const arPaymentTitle = '"lab.payment.title": "دفق واضح، وحالة مرتبطة بالطلب"';
if (!content.includes('"lab.payment.security": "')) {
    const idx = content.indexOf(arPaymentTitle);
    if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx) + 1;
        const arInsert = '      "lab.payment.security": "لا تعتمد حالة الدفع على إدخال العميل وحده.",\n';
        content = content.slice(0, endOfLine) + arInsert + content.slice(endOfLine);
        console.log('AR: lab.payment.security added');
    }
}

// English: lab.payment.security after lab.payment.title which we added
const enPaymentSecurityMarker = '"lab.payment.title": "Clear payment, order-linked status"';
if (!content.includes('"lab.payment.security": "Payment status is not dependent on client input alone."')) {
    const idx = content.indexOf(enPaymentSecurityMarker);
    if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx) + 1;
        const enInsert = '      "lab.payment.security": "Payment status is not dependent on client input alone.",\n';
        content = content.slice(0, endOfLine) + enInsert + content.slice(endOfLine);
        console.log('EN: lab.payment.security added');
    }
}

// Turkish: find the TR lab.payment.title we added
const trPaymentTitle = '"lab.payment.title": "Net ödeme, siparişle bağlantılı durum"';
if (!content.includes('"lab.payment.security": "Ödeme durumu yalnızca istemci girişine bağlı değildir."')) {
    const idx = content.indexOf(trPaymentTitle);
    if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx) + 1;
        const trInsert = '      "lab.payment.security": "Ödeme durumu yalnızca istemci girişine bağlı değildir.",\n';
        content = content.slice(0, endOfLine) + trInsert + content.slice(endOfLine);
        console.log('TR: lab.payment.security added');
    }
}

// 2. Add payment.crypto_value in all 3 blocks (for "USDC · BSC")
// Arabic: after payment.copySuccess, before payment.desc (which we changed)
const arCryptoMarker = '"payment.copySuccess": "تم نسخ العنوان."';
if (!content.includes('"payment.crypto_value": "USDC · BSC"')) {
    const idx = content.indexOf(arCryptoMarker);
    if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx) + 1;
        const arInsert = '      "payment.crypto_value": "USDC · BSC",\n';
        content = content.slice(0, endOfLine) + arInsert + content.slice(endOfLine);
        console.log('AR: payment.crypto_value added');
    }
}

// English: after payment.copySuccess, before payment.desc
const enCryptoMarker = '"payment.copySuccess": "Address copied."';
if (!content.includes('"payment.crypto_value": "USDC · BSC"')) {
    // Only one occurrence since we already added it in AR
    const idx = content.indexOf(enCryptoMarker);
    if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx) + 1;
        const enInsert = '      "payment.crypto_value": "USDC · BSC",\n';
        content = content.slice(0, endOfLine) + enInsert + content.slice(endOfLine);
        console.log('EN: payment.crypto_value added');
    }
}

// Turkish: after payment.copySuccess, before payment.desc
const trCryptoMarker = '"payment.copySuccess": "Adres kopyalandı."';
if (!content.includes('"payment.crypto_value": "USDC · BSC"')) {
    const idx = content.indexOf(trCryptoMarker);
    if (idx !== -1) {
        const endOfLine = content.indexOf('\n', idx) + 1;
        const trInsert = '      "payment.crypto_value": "USDC · BSC",\n';
        content = content.slice(0, endOfLine) + trInsert + content.slice(endOfLine);
        console.log('TR: payment.crypto_value added');
    }
}

fs.writeFileSync(file, content, 'utf8');
console.log('Done. Total lines:', content.split('\n').length);
