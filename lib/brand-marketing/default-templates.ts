import { MarketingTemplatePackage } from "./campaign-types";

export const DEFAULT_MARKETING_TEMPLATES: MarketingTemplatePackage[] = [
  {
    id: "tpl-ksn-intro-ko-v1",
    name: "K SELECT NETWORK — 브랜드 미국 진출 파트너십 제안서 (국문)",
    version: "1.0.0",
    language: "ko",
    subject: "[K SELECT] {{company_name}}의 미국 뷰티 리테일 네트워크 진출을 제안드립니다",
    previewText: "{{brand_name}}의 북미 온/오프라인 유통 및 바이어 큐레이션 프로그램 안내",
    status: "ACTIVE",
    isDefault: true,
    landingPageUrl: "https://www.kselectnetwork.com",
    variables: ["company_name", "contact_name", "brand_name", "custom_message"],
    htmlContent: `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K SELECT NETWORK</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #09090b; padding: 24px 32px; text-align: left;">
              <span style="color: #ffffff; font-size: 18px; font-weight: 800; letter-spacing: -0.5px;">K SELECT NETWORK</span>
              <span style="display: block; color: #a1a1aa; font-size: 11px; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Global Brand Sourcing & Distribution Hub</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <p style="font-size: 15px; font-weight: 700; color: #09090b; margin: 0 0 16px 0;">
                안녕하세요, {{company_name}} {{contact_name}} 귀하
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #3f3f46; margin: 0 0 16px 0;">
                K SELECT NETWORK는 북미(미국/캐나다) 온·오프라인 뷰티 리테일러 및 바이어 네트워크와 한국의 혁신적인 뷰티 브랜드를 직접 연결하는 통합 무역·유통 플랫폼입니다.
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #3f3f46; margin: 0 0 20px 0;">
                귀사의 대표 브랜드인 <strong>{{brand_name}}</strong>의 제품력과 시장 경쟁력을 높이 평가하여, 당사 북미 유통 프로그램의 셀렉션 후보로 제안드리고자 연락드렸습니다.
              </p>

              <!-- Custom message placeholder -->
              <div style="background-color: #f4f4f5; border-left: 4px solid #18181b; padding: 14px 18px; border-radius: 4px; margin: 0 0 24px 0; font-size: 13px; color: #27272a; line-height: 1.5;">
                {{custom_message}}
              </div>

              <!-- Value Props -->
              <div style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 18px; margin: 0 0 28px 0;">
                <p style="font-size: 13px; font-weight: 700; color: #09090b; margin: 0 0 10px 0;">K SELECT 파트너십 주요 혜택</p>
                <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #52525b; line-height: 1.6;">
                  <li>미국 현지 150+ 검증된 에스닉 및 주류 뷰티 리테일러 입점 지원</li>
                  <li>FDA VCRP/MoCRA 규제 준수 및 통관/물류 인프라 대행</li>
                  <li>주간 발주·정산 투명 보장 및 맞춤형 바이어 매칭 리포트</li>
                </ul>
              </div>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://www.kselectnetwork.com" target="_blank" style="display: inline-block; background-color: #09090b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 6px;">
                      K SELECT 파트너십 안내서 확인하기 →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f4f4f5; padding: 20px 32px; border-top: 1px solid #e4e4e7; text-align: left; font-size: 11px; color: #71717a; line-height: 1.5;">
              <p style="margin: 0 0 6px 0;">
                본 메일은 공공 전시회(InterCHARM Korea 등) 공식 디렉토리에 등록된 사업자 대표 연락처를 기반으로 발송된 기업 간(B2B) 파트너십 안내 메일입니다.
              </p>
              <p style="margin: 0;">
                수신을 원치 않으시면 support@kselectnetwork.com으로 회신 주시거나 거부 의사를 남겨주시면 즉시 수신거부 처리됩니다.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    plainText: `안녕하세요, {{company_name}} {{contact_name}} 귀하

K SELECT NETWORK는 북미 온·오프라인 뷰티 리테일러와 한국의 우수한 브랜드를 연결하는 유통 플랫폼입니다.
귀사의 브랜드인 {{brand_name}}의 북미 시장 진출을 제안드립니다.

{{custom_message}}

자세한 파트너십 안내: https://www.kselectnetwork.com
수신거부: support@kselectnetwork.com`,
  },
  {
    id: "tpl-ksn-intro-en-v1",
    name: "K SELECT NETWORK — Global Brand Partnership Proposal (English)",
    version: "1.0.0",
    language: "en",
    subject: "[K SELECT] Partnership Inquiry: North American Distribution for {{company_name}}",
    previewText: "Curated wholesale & retail expansion opportunities for {{brand_name}} in the US & Canada",
    status: "ACTIVE",
    isDefault: false,
    landingPageUrl: "https://www.kselectnetwork.com",
    variables: ["company_name", "contact_name", "brand_name", "custom_message"],
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K SELECT NETWORK</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #09090b; padding: 24px 32px; text-align: left;">
              <span style="color: #ffffff; font-size: 18px; font-weight: 800; letter-spacing: -0.5px;">K SELECT NETWORK</span>
              <span style="display: block; color: #a1a1aa; font-size: 11px; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">North American Retail & Wholesale Gateway</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <p style="font-size: 15px; font-weight: 700; color: #09090b; margin: 0 0 16px 0;">
                Dear {{contact_name}} and the {{company_name}} Team,
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #3f3f46; margin: 0 0 16px 0;">
                K SELECT NETWORK bridges innovative K-Beauty brands with leading North American specialty retail chains, regional store operators, and curated online buyers.
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #3f3f46; margin: 0 0 20px 0;">
                Following your exhibition presence, we are reaching out regarding {{brand_name}} as a candidate for our upcoming North American wholesale curation programs.
              </p>

              <div style="background-color: #f4f4f5; border-left: 4px solid #18181b; padding: 14px 18px; border-radius: 4px; margin: 0 0 24px 0; font-size: 13px; color: #27272a; line-height: 1.5;">
                {{custom_message}}
              </div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://www.kselectnetwork.com" target="_blank" style="display: inline-block; background-color: #09090b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 6px;">
                      Learn More About Our Retail Network →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f4f4f5; padding: 20px 32px; border-top: 1px solid #e4e4e7; text-align: left; font-size: 11px; color: #71717a; line-height: 1.5;">
              <p style="margin: 0 0 6px 0;">
                You received this business email because {{company_name}} is registered as an exhibitor in international beauty trade directories.
              </p>
              <p style="margin: 0;">
                To opt out of future communications, reply to support@kselectnetwork.com.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    plainText: `Dear {{contact_name}} and the {{company_name}} Team,

K SELECT NETWORK bridges innovative K-Beauty brands with North American retailers.
We would like to introduce wholesale distribution opportunities for {{brand_name}}.

{{custom_message}}

Learn more: https://www.kselectnetwork.com
Unsubscribe: reply to support@kselectnetwork.com`,
  },
];
