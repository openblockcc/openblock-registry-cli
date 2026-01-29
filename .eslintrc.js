module.exports = {
    extends: ['scratch', 'scratch/node', 'scratch/es6'],
    rules: {
        'no-console': 'off',
        'no-unused-vars': ['error', {argsIgnorePattern: '^_'}]
    }
};

