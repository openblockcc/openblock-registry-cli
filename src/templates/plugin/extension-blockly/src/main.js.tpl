const {BlockType, ArgumentType, ProgramModeType, formatMessage} = window.Scratch;

export default class {{className}} {

    get EXTENSION_ID () {
        return '{{pluginId}}';
    }

    get PINS_MENU () {
        return this.deviceInstance.PINS_MENU;
    }

    constructor (runtime, deviceInstance) {
        this.runtime = runtime;
        this.deviceInstance = deviceInstance;
    }

    get _peripheral () {
        return this.deviceInstance?._peripheral;
    }

    getInfo () {
        return [{
            id: this.EXTENSION_ID,
            name: formatMessage({
                id: '{{pluginId}}.categoryName',
                default: '{{pluginName}}'
            }),
            color1: '#4C97FF',
            color2: '#3373CC',
            color3: '#3373CC',
            blocks: [
                {
                    opcode: 'init',
                    blockType: BlockType?.COMMAND,
                    text: formatMessage({
                        id: '{{pluginId}}.init',
                        default: 'init {{pluginName}} pin [PIN]'
                    }),
                    arguments: {
                        PIN: {
                            type: ArgumentType?.STRING,
                            menu: 'pins',
                            defaultValue: this.PINS_MENU?.[0]?.value
                        }
                    }
                },
                {
                    opcode: 'doSomething',
                    blockType: BlockType?.COMMAND,
                    text: formatMessage({
                        id: '{{pluginId}}.doSomething',
                        default: 'do something [VALUE]'
                    }),
                    arguments: {
                        VALUE: {
                            type: ArgumentType?.NUMBER,
                            defaultValue: '100'
                        }
                    },
                    programMode: [ProgramModeType?.UPLOAD]
                }
            ],
            menus: {
                pins: {items: this.PINS_MENU}
            }
        }];
    }

    init (args) {
        if (this._peripheral?.isReady()) {
            // Initialize hardware
            return Promise.resolve();
        }
    }

    doSomething (args) {
        // Implement realtime mode behavior
        return Promise.resolve();
    }
}

