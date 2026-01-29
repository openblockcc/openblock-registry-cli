export default Blockly => {

    Blockly.Arduino.{{pluginId}}_setDigitalOutput = function (block) {
        const pin = block.getFieldValue('PIN');
        const level = block.getFieldValue('LEVEL');

        Blockly.Arduino.setups_[`{{pluginId}}_pin_${pin}`] = `pinMode(${pin}, OUTPUT);`;

        return `digitalWrite(${pin}, ${level});\n`;
    };

    return Blockly;
};

