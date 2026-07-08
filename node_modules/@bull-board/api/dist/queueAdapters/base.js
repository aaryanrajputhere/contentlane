"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAdapter = void 0;
class BaseAdapter {
    constructor(type, options = {}) {
        this.formatters = new Map();
        this._visibilityGuard = () => true;
        this.readOnlyMode = options.readOnlyMode === true;
        this.allowRetries = this.readOnlyMode ? false : options.allowRetries !== false;
        this.allowCompletedRetries = this.allowRetries && options.allowCompletedRetries !== false;
        this.prefix = options.prefix || '';
        this.delimiter = options.delimiter || '';
        this.description = options.description || '';
        this.displayName = options.displayName || '';
        this.type = type;
        this.externalJobUrl = options.externalJobUrl;
    }
    getDescription() {
        return this.description;
    }
    getDisplayName() {
        return this.displayName;
    }
    setFormatter(field, formatter) {
        this.formatters.set(field, formatter);
    }
    format(field, data, defaultValue = data) {
        const fieldFormatter = this.formatters.get(field);
        return typeof fieldFormatter === 'function' ? fieldFormatter(data) : defaultValue;
    }
    setVisibilityGuard(guard) {
        this._visibilityGuard = guard;
    }
    isVisible(request) {
        return this._visibilityGuard(request);
    }
}
exports.BaseAdapter = BaseAdapter;
//# sourceMappingURL=base.js.map