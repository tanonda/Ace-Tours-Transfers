import 'dotenv/config';
import { insertTourSchema } from './shared/schema.js';

const testData = {
    title: 'Test Tour',
    price: '120',
    childPrice: '60',
    duration: '2 hours',
    minPax: '2',
    category: 'tour',
    defaultCapacity: 20,
    description: ['Sample description line 1', 'Sample description line 2'],
    image: 'http://example.com/test.jpg',
    vehicleDetails: null,
};

try {
    const result = insertTourSchema.parse(testData);
    console.log("Validation successful:", result);
} catch (error: any) {
    if (error.errors) {
        console.error("Validation failed:", JSON.stringify(error.errors, null, 2));
    } else {
        console.error("Other error:", error);
    }
}
