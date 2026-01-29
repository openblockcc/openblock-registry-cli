const {BlockType, ArgumentType, formatMessage} = window.Scratch;

/**
 * USB device filters for serial port detection.
 * @readonly
 */
const PNPID_LIST = [
    // CH340
    'USB\\VID_1A86&PID_7523',
    // CP2102
    'USB\\VID_10C4&PID_EA60'
];

/**
 * Serialport configuration.
 * @readonly
 */
const SERIAL_CONFIG = {
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1
};

/**
 * MicroPython configuration.
 * @readonly
 */
const DEVICE_OPT = {
    type: 'microPython',
    chip: 'esp32',
    baud: {
        darwin: '460800',
        linux: '460800',
        win32: '921600'
    }
};

const Pins = {
    IO2: '2',
    IO4: '4',
    IO5: '5',
    IO12: '12',
    IO13: '13',
    IO14: '14',
    IO15: '15'
};

/**
 * MicroPython peripheral communication class.
 */
class {{className}}MicroPythonPeripheral extends MicroPythonPeripheral {
    constructor (runtime, deviceId, originalDeviceId) {
        super(runtime, deviceId, originalDeviceId, PNPID_LIST, SERIAL_CONFIG, DEVICE_OPT);
    }
}

/**
 * OpenBlock MicroPython device blocks.
 */
export default class {{className}}MicroPythonDevice {

    get DEVICE_ID () {
        return '{{pluginId}}';
    }

    get PINS_MENU () {
        return Object.entries(Pins).map(([text, value]) => ({text, value}));
    }

    constructor (runtime, originalDeviceId) {
        this.runtime = runtime;
        this._peripheral = new {{className}}MicroPythonPeripheral(
            this.runtime, this.DEVICE_ID, originalDeviceId
        );
    }

    getInfo () {
        return [
            {
                id: 'pin',
                name: formatMessage({
                    id: '{{pluginId}}.category.pins',
                    default: 'Pins'
                }),
                color1: '#4C97FF',
                color2: '#3373CC',
                color3: '#3373CC',
                blocks: [
                    {
                        opcode: 'setDigitalOutput',
                        text: formatMessage({
                            id: '{{pluginId}}.pins.setDigitalOutput',
                            default: 'set pin [PIN] to [VALUE]'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'pins',
                                defaultValue: Pins.IO2
                            },
                            VALUE: {
                                type: ArgumentType.NUMBER,
                                defaultValue: '1'
                            }
                        }
                    }
                ],
                menus: {
                    pins: {items: this.PINS_MENU}
                }
            }
        ];
    }

    setDigitalOutput (args) {
        // MicroPython realtime mode implementation
        return Promise.resolve();
    }
}

