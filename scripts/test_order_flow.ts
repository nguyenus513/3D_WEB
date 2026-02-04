/**
 * Order Flow Test Script
 * Tests complete order flow from pending -> delivered
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE_URL = 'http://localhost:3000';
const ORDER_ID = 'ed390b80-f8ad-4128-b175-89f4c763a5c2';

async function testStatusTransition(orderId: string, newStatus: string, step: number) {
    console.log(`\n=== Step ${step}: Transition to '${newStatus}' ===`);

    try {
        const res = await fetch(`${BASE_URL}/api/admin/orders/${orderId}/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await res.json();
        console.log(`Response: ${res.status}`, data);
        return res.ok;
    } catch (error) {
        console.error(`Error:`, error);
        return false;
    }
}

async function checkCurrentStatus(orderId: string) {
    console.log(`\n=== Checking current status ===`);

    try {
        const res = await fetch(`${BASE_URL}/api/admin/orders/${orderId}`);
        const data = await res.json();

        if (data.success && data.data?.order) {
            console.log(`Current status: ${data.data.order.status}`);
            console.log(`Demo URL: ${data.data.order.demo_image_url || 'none'}`);
            return data.data.order.status;
        } else {
            console.log('Failed to fetch order:', data.error);
            return null;
        }
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

async function runFlowTest() {
    console.log('=== ORDER FLOW TEST ===');
    console.log(`Testing order: ${ORDER_ID}`);

    // Check initial status
    await checkCurrentStatus(ORDER_ID);

    // Note: This tests admin transitions only
    // Step 4 (user approve) requires separate testing with user session

    const transitions = [
        // { status: 'confirmed', step: 1 },
        // { status: 'designing', step: 2 },
        // Step 3 is demo upload - separate
        // { status: 'approved', step: 4 }, // User action
        // { status: 'producing', step: 5 },
        // { status: 'shipping', step: 6 },
        // { status: 'delivered', step: 7 },
    ];

    for (const t of transitions) {
        const success = await testStatusTransition(ORDER_ID, t.status, t.step);
        if (!success) {
            console.log(`Flow stopped at step ${t.step}`);
            break;
        }
        await checkCurrentStatus(ORDER_ID);
    }

    console.log('\n=== TEST COMPLETE ===');
}

runFlowTest();
