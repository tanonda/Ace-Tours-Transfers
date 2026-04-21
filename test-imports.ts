import Client1 from 'android-sms-gateway';
import * as Client2 from 'android-sms-gateway';
import { default as Client3 } from 'android-sms-gateway';

const c1 = new Client1('login', 'pass', {} as any, 'url');
const c2 = new Client2.default('login', 'pass', {} as any, 'url');
const c3 = new Client3('login', 'pass', {} as any, 'url');
