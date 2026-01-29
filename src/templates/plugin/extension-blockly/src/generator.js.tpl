export default Blockly => {

    Blockly.Arduino.{{pluginId}}_init = function (block) {
        const pin = block.getFieldValue('PIN');

        Blockly.Arduino.includes_.{{pluginId}}_init = `// Include your library here`;
        Blockly.Arduino.definitions_.{{pluginId}}_init = `// Define variables here`;

        return `// init code for pin ${pin}\n`;
    };

    Blockly.Arduino.{{pluginId}}_doSomething = function (block) {
        const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC) || '100';

        return `// do something with value ${value}\n`;
    };

    return Blockly;
};

