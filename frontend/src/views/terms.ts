import { t } from '../i18n/index.js';

export function renderTerms(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "container mx-auto px-4 py-8 max-w-4xl mb-8";

    wrap.innerHTML = `
        <h1 class="font-display font-black text-4xl font-bold text-text mb-6">${t('terms.title')}</h1>
        
        <div class="prose prose-lg bg-prem rounded-lg shadow-xl p-6 font-sans text-text">
            <p class="text-text/70 mb-4">${t('terms.lastUpdated')}: ${new Date().toLocaleDateString()}</p>
            
            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">1. ${t('terms.section1.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('terms.section1.content1')}
                </p>
                <p class="mb-4 text-text">
                    ${t('terms.section1.content2')}
                </p>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">2. ${t('terms.section2.title')}</h2>
                <p class="mb-4 text-text">${t('terms.section2.intro')}</p>
                <ul class="list-disc pl-6 mb-4 space-y-2 text-text">
                    <li>${t('terms.section2.item1')}</li>
                    <li>${t('terms.section2.item2')}</li>
                    <li>${t('terms.section2.item3')}</li>
                    <li>${t('terms.section2.item4')}</li>
                    <li>${t('terms.section2.item5')}</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">3. ${t('terms.section3.title')}</h2>
                <p class="mb-4 text-text">${t('terms.section3.intro')}</p>
                <ul class="list-disc pl-6 mb-4 space-y-2 text-text">
                    <li>${t('terms.section3.item1')}</li>
                    <li>${t('terms.section3.item2')}</li>
                    <li>${t('terms.section3.item3')}</li>
                    <li>${t('terms.section3.item4')}</li>
                    <li>${t('terms.section3.item5')}</li>
                    <li>${t('terms.section3.item6')}</li>
                    <li>${t('terms.section3.item7')}</li>
                    <li>${t('terms.section3.item8')}</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">4. ${t('terms.section4.title')}</h2>
                <p class="mb-4 text-text">${t('terms.section4.intro')}</p>
                <ul class="list-disc pl-6 mb-4 space-y-2 text-text">
                    <li>${t('terms.section4.item1')}</li>
                    <li>${t('terms.section4.item2')}</li>
                    <li>${t('terms.section4.item3')}</li>
                    <li>${t('terms.section4.item4')}</li>
                    <li>${t('terms.section4.item5')}</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">5. ${t('terms.section5.title')}</h2>
                <p class="mb-4 text-text">${t('terms.section5.content')}</p>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">6. ${t('terms.section6.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('terms.section6.content')}
                </p>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">7. ${t('terms.section7.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('terms.section7.content')}
                </p>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">8. ${t('terms.section8.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('terms.section8.content')}
                </p>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">9. ${t('terms.section9.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('terms.section9.content')}
                </p>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">10. ${t('terms.contact.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('terms.contact.content')}<br>
                    ${t('terms.contact.email')}: <a href="mailto:mleonet@student.42belgium.be" class="text-sec hover:underline">mleonet@student.42belgium.be</a><br>
                    ${t('terms.contact.project')}
                </p>
            </section>
        </div>

        <div class="mt-8">
            <a href="/" data-navigate="/" class="text-sec hover:text-sec/80 font-sans">
                ← ${t('common.back')}
            </a>
        </div>
    `;

    return wrap;
}

export default renderTerms;