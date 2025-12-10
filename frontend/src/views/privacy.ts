import { t } from '../i18n/index.js';

export function renderPrivacy(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "container mx-auto px-4 py-8 max-w-4xl mb-8";

    wrap.innerHTML = `
        <h1 class="font-display font-black text-4xl font-bold text-text mb-6">${t('privacy.title')}</h1>
        
        <div class="prose prose-lg bg-prem rounded-lg shadow-xl p-6 font-sans text-text">
            <p class="text-text/70 mb-4">${t('privacy.lastUpdated')}: ${new Date().toLocaleDateString()}</p>
            
            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">1. ${t('privacy.section1.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('privacy.section1.intro')}
                </p>
                <ul class="list-disc pl-6 mb-4 space-y-2 text-text">
                    <li>${t('privacy.section1.item1')}</li>
                    <li>${t('privacy.section1.item2')}</li>
                    <li>${t('privacy.section1.item3')}</li>
                    <li>${t('privacy.section1.item4')}</li>
                    <li>${t('privacy.section1.item5')}</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">2. ${t('privacy.section2.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('privacy.section2.intro')}
                </p>
                <ul class="list-disc pl-6 mb-4 space-y-2 text-text">
                    <li>${t('privacy.section2.item1')}</li>
                    <li>${t('privacy.section2.item2')}</li>
                    <li>${t('privacy.section2.item3')}</li>
                    <li>${t('privacy.section2.item4')}</li>
                    <li>${t('privacy.section2.item5')}</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">3. ${t('privacy.section3.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('privacy.section3.intro')}
                </p>
                <ul class="list-disc pl-6 mb-4 space-y-2 text-text">
                    <li>${t('privacy.section3.item1')}</li>
                    <li>${t('privacy.section3.item2')}</li>
                    <li>${t('privacy.section3.item3')}</li>
                    <li>${t('privacy.section3.item4')}</li>
                    <li>${t('privacy.section3.item5')}</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">4. ${t('privacy.section4.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('privacy.section4.intro')}
                </p>
                <ul class="list-disc pl-6 mb-4 space-y-2 text-text">
                    <li>${t('privacy.section4.item1')}</li>
                    <li>${t('privacy.section4.item2')}</li>
                    <li>${t('privacy.section4.item3')}</li>
                    <li>${t('privacy.section4.item4')}</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">5. ${t('privacy.section5.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('privacy.section5.intro')}
                </p>
                <ul class="list-disc pl-6 mb-4 space-y-2 text-text">
                    <li>${t('privacy.section5.item1')}</li>
                    <li>${t('privacy.section5.item2')}</li>
                    <li>${t('privacy.section5.item3')}</li>
                    <li>${t('privacy.section5.item4')}</li>
                    <li>${t('privacy.section5.item5')}</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">6. ${t('privacy.section6.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('privacy.section6.content')}
                </p>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">7. ${t('privacy.section7.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('privacy.section7.content')}
                </p>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">8. ${t('privacy.section8.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('privacy.section8.content')}
                </p>
            </section>

            <section class="mb-8">
                <h2 class="font-display font-black text-2xl font-semibold text-text mb-4">9. ${t('privacy.contact.title')}</h2>
                <p class="mb-4 text-text">
                    ${t('privacy.contact.content')}<br>
                    ${t('privacy.contact.email')}: <a href="mailto:mleonet@student.42belgium.be" class="text-sec hover:underline">mleonet@student.42belgium.be</a><br>
                    ${t('privacy.contact.project')}
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

export default renderPrivacy;