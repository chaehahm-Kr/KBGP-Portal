import * as fs from 'fs';
import * as path from 'path';
import { IndieBeautyShowAdapter } from '../lib/brand-sourcing/adapters/indie-beauty-show.adapter';

async function main() {
  const adapter = new IndieBeautyShowAdapter();

  const samples = [
    {
      id: 'Sample 1',
      brand: '언리시아 (Unleashia)',
      file: path.resolve(__dirname, '../../sample1.html'),
      url: 'https://indiebeautyshow.com/exhibitor-list2026/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=170410507&t=board',
      idx: '170410507',
    },
    {
      id: 'Sample 2',
      brand: '에필로우 (Efilow)',
      file: path.resolve(__dirname, '../../sample2.html'),
      url: 'https://indiebeautyshow.com/exhibitor-list2026/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=170410597&t=board',
      idx: '170410597',
    },
    {
      id: 'Sample 3',
      brand: '허스텔러 (Hersteller)',
      file: path.resolve(__dirname, '../../sample3.html'),
      url: 'https://indiebeautyshow.com/exhibitor-list2026/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=170410669&t=board',
      idx: '170410669',
    },
  ];

  console.log('================================================================================');
  console.log('FIELD-LEVEL EXTRACTION REPORT: INDIE BEAUTY SHOW 2026 (SAMPLES 1, 2, 3)');
  console.log('================================================================================\n');

  for (const s of samples) {
    const html = fs.readFileSync(s.file, 'utf8');
    const draft = await (adapter as any).parseHtml(html, s.url, s.idx, { enrichWebsite: false });

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`${s.id}: ${s.brand}`);
    console.log(`URL: ${s.url}`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`[COMPANY & BRAND]`);
    console.log(`  - Exhibitor / Brand Name (Kr):  ${draft.company.nameKr || '[MISSING]'}`);
    console.log(`  - Legal Entity Corporate Name:   [UNVERIFIED - Subject to Admin confirmation]`);
    console.log(`  - Business Types:                ${draft.company.businessTypes.join(', ')}`);
    console.log(`  - Primary Category Recommended:  ${draft.company.primaryProductCategories.join(', ') || '[UNCLASSIFIED]'}`);
    console.log(`  - Business Registration No:      ${draft.company.businessRegistrationNumber || '[MISSING - Not on expo page]'}`);

    console.log(`[REPRESENTATIVE & CONTACTS]`);
    console.log(`  - Representative Name:           ${draft.company.representativeName || '[MISSING]'}`);
    const primaryContact = draft.contacts.find((c: any) => c.isPrimary) || draft.contacts[0];
    console.log(`  - Primary Email:                 ${primaryContact?.email || '[MISSING]'}`);
    console.log(`  - Phone:                         ${primaryContact?.phone || '[MISSING]'}`);

    console.log(`[ADDRESS & WEBSITES]`);
    console.log(`  - Formatted Address (Kr):        ${draft.company.address.formattedKr || '[MISSING]'}`);
    console.log(`  - Website:                       ${draft.websites[0]?.url || '[MISSING]'}`);

    console.log(`[COMPANY DESCRIPTION]`);
    const desc = draft.company.descriptionKr || '';
    console.log(`  - Length:                        ${desc.length} chars`);
    console.log(`  - Preview:                       ${desc ? desc.substring(0, 80).replace(/\n/g, ' ') + '...' : '[MISSING]'}`);

    console.log(`[PRODUCTS / IMAGES]`);
    console.log(`  - Products Count:                ${draft.companyProducts.length}`);
    draft.companyProducts.forEach((p: any, idx: number) => {
      console.log(`    #${idx + 1}: ${p.titleKr || 'Untitled'} | Image: ${p.imageUrl ? 'YES' : 'NO'} | Desc: ${p.description ? p.description.substring(0, 40) + '...' : 'None'}`);
    });

    console.log(`[STATUS & AUDIT]`);
    console.log(`  - Audit Status:                  ${draft.audit.status}`);
    console.log(`  - Missing Key Fields:            ${draft.audit.missingKeyFields.join(', ') || 'None'}`);
    console.log(`  - Notes:                         ${draft.audit.notes.join(' | ')}\n`);
  }
}

main().catch(console.error);
