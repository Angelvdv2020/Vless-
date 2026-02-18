// Simple smoke test
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Running smoke tests...');

const tests = [
  {
    name: 'Config file exists',
    test: () => {
      return fs.existsSync('./.env.example');
    }
  },
  {
    name: 'Package.json is valid',
    test: () => {
      const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
      return pkg.name && pkg.version;
    }
  },
  {
    name: 'Web pages exist',
    test: () => {
      return fs.existsSync('./web/pages/index.html');
    }
  },
  {
    name: 'CSS styles exist',
    test: () => {
      return fs.existsSync('./web/assets/styles.css');
    }
  }
];

let passed = 0;
let failed = 0;

tests.forEach(({ name, test }) => {
  try {
    if (test()) {
      console.log(`✓ ${name}`);
      passed++;
    } else {
      console.log(`✗ ${name}`);
      failed++;
    }
  } catch (error) {
    console.log(`✗ ${name} - Error: ${error.message}`);
    failed++;
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
