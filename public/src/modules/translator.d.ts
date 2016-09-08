
/// <reference path="../../../node_modules/@types/es6-promise/index.d.ts" />

interface Translator {
    /**
     * Parse the translation instructions into the language of the Translator instance
     * @param str - Source string
     */
    translate(str: string): Promise<string>;

    /**
     * Translates a specific key and array of arguments
     * @param name - Translation key (ex. 'global:home')
     * @param args - Arguments for `%1`, `%2`, etc
     */
    translateKey(name: string, args: string[]): Promise<string>;

    /**
     * Load translation file (or use a cached version), and optionally return the translation of a certain key
     * @param namespace - The file name of the translation namespace
     * @param key - The key of the specific translation to getJSON
     */
    getTranslation(namespace: string, key? :string): Promise<Object|string>;

    modules: {
        [namespace: string]: TranslatorModule;
    };
}

interface TranslatorFactory {
    /**
     * Construct a new Translator object
     * @param language - Language code for this Translator instance
     */
    new(language: string): Translator;

    /**
     * Get the language of the current environment, falling back to defaults
     */
    getLanguage(): string;

    /**
     * Create and cache a new Translator instance, or return a cached one
     * @param language - Language code
     */
    create(language?: string): Translator;

    /**
     * Register a custom module to handle translations
     * @param namespace - Namespace to handle translations for
     * @param factory - Function to return the translation function for this namespace
     */
    registerModule(namespace: string, factory: ModuleFactory);

    moduleFactories: { 
        [namespace: string]: ModuleFactory;
    };

    cache: {
        [language: string]: Translator;
    };
}

interface TranslatorModule {
    (key: string, args: string[]): string;
}

interface ModuleFactory {
    (language: string): TranslatorModule;
}

interface Callback {
    (err: Error, data: any): void;
}

interface TranslatorAdaptor {
    /**
     * The Translator class
     */
    Translator: TranslatorFactory;

    /**
     * Legacy translator function for backwards compatibility
     */
    translate(text: string, language: string, callback: Callback);
    translate(text: string, callback: Callback);

    /**
     * Construct a translator pattern
     * @param name - Translation name
     * @param args - Optional arguments for the pattern
     */
    compile(name: string, ...args: string[]): string;
    
    /**
     * Escape translation patterns from text
     */
    escape(text): string;

    /**
     * Unescape translation patterns from text
     */
    unescape(text): string;

    /**
     * Add translations to the cache
     */
    addTranslation(language: string, filename: string, translation: { [key: string]: string; });

    /**
     * Get the translations object
     */
    getTranslations(language: string, filename: string, callback?: Callback);

    /**
     * Alias of TranslatorAdaptor.getTranslations
     */
    load(language: string, filename: string, callback?: Callback);

    /**
     * Get the language of the current environment, falling back to defaults
     */
    getLanguage(): string;

    toggleTimeagoShorthand();
    prepareDOM();
}

declare var adaptor: TranslatorAdaptor;

export = adaptor;
