const fs = require('fs');
const pdfParse = require('pdf-parse');

async function main() {
    const pdfPath = 'Manuals/MAN-B-ORD-001_Order-Management/03_PUBLISHED/MAN-B-ORD-001_Order-Management_V1.pdf';
    const dataBuffer = fs.readFileSync(pdfPath);

    const data = await pdfParse(dataBuffer);
    console.log('=== PDF QA REPORT ===');
    console.log('Total Pages:', data.numpages);
    
    // Check for banned phrases
    const text = data.text;
    const banned = ['검수 및 정산 완료', '대금 정산 완료', '정산이 최종 완료', 'REVIEW', 'TODO'];
    console.log('\n--- BANNED PHRASES CHECK ---');
    let bannedFound = false;
    banned.forEach(b => {
        const count = (text.match(new RegExp(b, 'g')) || []).length;
        console.log(`- '${b}': ${count} occurrences`);
        if (count > 0) bannedFound = true;
    });

    console.log('\n--- CANONICAL DOMAIN TERMS CHECK ---');
    const canonical = ['오더 이행 최종 종결', '입고/오더 완료', 'Supplier Confirmed', 'CONFIRMED', 'MAN-B-LOG-001', 'MAN-B-FIN-001'];
    canonical.forEach(c => {
        const count = (text.match(new RegExp(c, 'g')) || []).length;
        console.log(`- '${c}': ${count} occurrences`);
    });

    if (data.numpages === 20 && !bannedFound) {
        console.log('\n>>> RESULT: PDF QA PASS (20/20 Pages, 0 Banned Phrases)');
    } else {
        console.log('\n>>> RESULT: PDF QA FAIL');
    }
}

main().catch(console.error);
