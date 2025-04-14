import { strictEqual, ok } from 'assert';
import LoggerWithIndentation from './LoggerWithIndentation.mjs';
import { createRequire } from 'module';
import registerAsyncDynamicTestCreation from './registerTestFile.mjs';
import './cleanup.mjs';
const require = createRequire(import.meta.url);

// Function to simulate your app logic
function calculate(input) {
    return eval(input); // For demo; avoid in production
}

// Static test to confirm file loading
describe('Static Test', function () {
    it('should always pass', function () {
        strictEqual(1, 1);
    });
});

const logger = new LoggerWithIndentation();
const log = (level) => logger.getLogger(level);

// Dynamic test suite with async setup
const promise = (async () => {
    const db = require('./mocks/databasemock.js');
    const nconf = require('nconf');
    const dbName = nconf.get('database');
    if (dbName !== 'mysql') {
        log(0).info('Skipping dynamic test suite because database is not MySQL');
        return;
    }
    logger.recorder.startRecording();

    log(0).info('Setting up dynamic test suite...');
    let connection;
    let testCases = [];

    try {
        await db.init();
        connection = db.pool
        log(1).info('Connected to database!');

        // Create the test_cases table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS test_cases (
                id INT AUTO_INCREMENT PRIMARY KEY,
                input VARCHAR(255),
                expected_output VARCHAR(255)
            )
        `);
        log(1).info('Ensured test_cases table exists');

        // Clear existing data to avoid duplicates
        await connection.execute('TRUNCATE TABLE test_cases');
        log(1).info('Cleared test_cases table');

        // Insert test data
        await connection.execute(`
            INSERT INTO test_cases (input, expected_output) VALUES
                ('2 + 2', '4'),
                ('5 * 3', '15'),
                ('10 - 7', '3')
        `);
        log(1).info('Inserted test data');

        // Fetch test cases
        const [rows] = await connection.execute('SELECT input, expected_output FROM test_cases');
        log(1).info('Rows fetched: ', rows);
        testCases = rows;
    } catch (error) {
        console.error('Error during setup:', error.message);
        throw error;
    }

    // Define the test suite
    describe('Dynamic Tests from MySQL', function () {
        log(1).info('Defining dynamic tests with testCases:', testCases);

        if (testCases.length === 0) {
            it('should indicate no test cases', function () {
                ok(true, 'No test cases were found in the database');
            });
        } else {
            testCases.forEach(({ input, expected_output }, index) => {
                it(`should calculate ${input} to equal ${expected_output} (test ${index + 1})`, function () {
                    const result = calculate(input);
                    strictEqual(result, parseInt(expected_output, 10));
                });
            });
        }

        after(async function () {
            log(0).info('Cleaning up after tests...');
            const connection = db.pool
            try {
                await connection.execute('DROP TABLE IF EXISTS test_cases');
                log(0).info('Dropped test_cases table');
            } catch (error) {
                log(0).error('Error during cleanup');
                log(0).error(error.stack);
            }
        });
    });

    log(0).info('Dynamic test suite setup complete');
})();

registerAsyncDynamicTestCreation(promise);

promise.catch(err => {
    log(0).error('Setup failed:', err);
    process.exit(1);
}).finally(() => {
    logger.recorder.stopRecording();
});
