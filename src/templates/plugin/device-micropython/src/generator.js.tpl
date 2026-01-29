export default Blockly => {

    Blockly.Python.{{pluginId}}_setDigitalOutput = function (block) {
        const pin = block.getFieldValue('PIN');
        const value = Blockly.Python.valueToCode(block, 'VALUE', Blockly.Python.ORDER_ATOMIC) || '1';

        Blockly.Python.definitions_['import_machine'] = 'from machine import Pin';
        Blockly.Python.definitions_[`{{pluginId}}_pin_${pin}`] = `pin_${pin} = Pin(${pin}, Pin.OUT)`;

        return `pin_${pin}.value(${value})\n`;
    };

    return Blockly;
};

