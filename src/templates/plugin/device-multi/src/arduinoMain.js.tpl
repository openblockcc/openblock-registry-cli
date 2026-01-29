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
 * Arduino-cli configuration.
 * @readonly
 */
const DEVICE_OPT = {
    type: 'arduino',
    fqbn: {
        darwin: 'esp32:esp32:esp32:UploadSpeed=460800',
        linux: 'esp32:esp32:esp32:UploadSpeed=460800',
        win32: 'esp32:esp32:esp32:UploadSpeed=921600'
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

const Level = {
    High: 'HIGH',
    Low: 'LOW'
};

/**
 * Arduino peripheral communication class.
 */
class {{className}}ArduinoPeripheral extends ArduinoPeripheral {
    constructor (runtime, deviceId, originalDeviceId) {
        super(runtime, deviceId, originalDeviceId, PNPID_LIST, SERIAL_CONFIG, DEVICE_OPT);
    }
}

/**
 * OpenBlock Arduino device blocks.
 */
export default class {{className}}ArduinoDevice {

    get DEVICE_ID () {
        return '{{pluginId}}';
    }

    get PINS_MENU () {
        return Object.entries(Pins).map(([text, value]) => ({text, value}));
    }

    get LEVEL_MENU () {
        return [
            {
                text: formatMessage({
                    id: '{{pluginId}}.levelMenu.high',
                    default: 'high'
                }),
                value: Level.High
            },
            {
                text: formatMessage({
                    id: '{{pluginId}}.levelMenu.low',
                    default: 'low'
                }),
                value: Level.Low
            }
        ];
    }

    constructor (runtime, originalDeviceId) {
        this.runtime = runtime;
        this._peripheral = new {{className}}ArduinoPeripheral(
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
                            default: 'set digital pin [PIN] to [LEVEL]'
                        }),
                        blockType: BlockType.COMMAND,
                        arguments: {
                            PIN: {
                                type: ArgumentType.STRING,
                                menu: 'pins',
                                defaultValue: Pins.IO2
                            },
                            LEVEL: {
                                type: ArgumentType.STRING,
                                menu: 'level',
                                defaultValue: Level.High
                            }
                        }
                    }
                ],
                menus: {
                    pins: {items: this.PINS_MENU},
                    level: {items: this.LEVEL_MENU}
                }
            }
        ];
    }

    setDigitalOutput (args) {
        this._peripheral.setDigitalOutput(args.PIN, args.LEVEL);
        return Promise.resolve();
    }
}

