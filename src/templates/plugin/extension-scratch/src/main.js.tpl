const {BlockType, ArgumentType, ProgramModeType, formatMessage} = window.Scratch;

export default class {{className}} {

    get EXTENSION_ID () {
        return '{{pluginId}}';
    }

    constructor (runtime) {
        this.runtime = runtime;
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
                    opcode: 'exampleBlock',
                    blockType: BlockType?.COMMAND,
                    text: formatMessage({
                        id: '{{pluginId}}.exampleBlock',
                        default: 'example block [TEXT]'
                    }),
                    arguments: {
                        TEXT: {
                            type: ArgumentType?.STRING,
                            defaultValue: 'hello'
                        }
                    }
                },
                {
                    opcode: 'exampleReporter',
                    blockType: BlockType?.REPORTER,
                    text: formatMessage({
                        id: '{{pluginId}}.exampleReporter',
                        default: 'example value'
                    })
                }
                // Upload mode block example (uncomment if supportUpload is true):
                // {
                //     opcode: 'uploadModeBlock',
                //     blockType: BlockType?.COMMAND,
                //     text: formatMessage({
                //         id: '{{pluginId}}.uploadModeBlock',
                //         default: 'upload mode block [VALUE]'
                //     }),
                //     arguments: {
                //         VALUE: {
                //             type: ArgumentType?.NUMBER,
                //             defaultValue: '100'
                //         }
                //     },
                //     programMode: [ProgramModeType?.UPLOAD]
                // }
            ],
            menus: {}
        }];
    }

    exampleBlock (args) {
        console.log('Example block:', args.TEXT);
        return Promise.resolve();
    }

    exampleReporter () {
        return 'Hello from {{pluginName}}!';
    }

    // Upload mode block implementation (uncomment if supportUpload is true):
    // uploadModeBlock (args) {
    //     return Promise.resolve();
    // }
}

