import { t } from '../i18n/index.js';

export function renderFooter(): string {
    return `
        <footer class="bg-gray-800 text-white py-3">
            <div class="container mx-auto px-4">
                <div class="flex flex-col md:flex-row justify-between items-center">
                    <div class="mb-2 md:mb-0">
                        <p class="font-sans text-xs">&copy; ${new Date().getFullYear()} ft_transcendence. ${t('footer.allRightsReserved')}</p>
                    </div>
                    <div class="flex space-x-4 text-xs">
                        <a href="/privacy" data-navigate="/privacy" class="hover:text-gray-300 transition-colors font-sans">
                            ${t('footer.privacyPolicy')}
                        </a>
                        <a href="/terms" data-navigate="/terms" class="hover:text-gray-300 transition-colors font-sans">
                            ${t('footer.termsOfService')}
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    `;
}