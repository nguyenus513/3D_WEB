-- ============================================================================
-- Optimization D: Update place_order_with_stock_check to use unified tables
-- Date: 2026-02-06
-- ============================================================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS place_order_with_stock_check(UUID, UUID, VARCHAR, TEXT, TEXT, INT, NUMERIC, JSONB);

-- Create the RPC function
CREATE OR REPLACE FUNCTION place_order_with_stock_check(
    p_user_id UUID,
    p_product_id UUID,
    p_product_sku VARCHAR(50),
    p_product_name TEXT,
    p_product_type TEXT DEFAULT 'product',
    p_quantity INT DEFAULT 1,
    p_unit_price NUMERIC DEFAULT 0,
    p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS JSONB AS $$
DECLARE
    v_current_stock INT;
    v_order_id UUID;
    v_code_child VARCHAR(12);
    v_customer_code VARCHAR(20);
    v_transfer_content TEXT;
    v_total_price NUMERIC;
    v_bank_config RECORD;
    v_qr_url TEXT;
BEGIN
    -- Calculate total price
    v_total_price := p_quantity * p_unit_price;

    -- Lock and check stock (FOR UPDATE prevents race condition)
    SELECT stock INTO v_current_stock
    FROM products
    WHERE id = p_product_id
    FOR UPDATE;

    -- Check if product exists
    IF v_current_stock IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'PRODUCT_NOT_FOUND',
            'message', 'S?n ph?m không t?n t?i'
        );
    END IF;

    -- Check if enough stock
    IF v_current_stock < p_quantity THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INSUFFICIENT_STOCK',
            'message', 'S?n ph?m không d? s? lu?ng trong kho',
            'available', v_current_stock,
            'requested', p_quantity
        );
    END IF;

    -- Deduct stock
    UPDATE products
    SET stock = stock - p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id;

    -- Generate order code (12 char hex)
    v_code_child := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FOR 12));

    -- Get customer code from profiles
    SELECT COALESCE(customer_code, 'USR-' || UPPER(SUBSTRING(REPLACE(p_user_id::TEXT, '-', '') FOR 8)))
    INTO v_customer_code
    FROM profiles
    WHERE id = p_user_id;

    -- Generate transfer content
    v_transfer_content := v_customer_code || '-' || v_code_child;

    -- Get bank config
    SELECT bank_code, account_no, account_name
    INTO v_bank_config
    FROM payment_configs
    WHERE order_type = 'ready_made' AND is_active = true
    LIMIT 1;

    -- Fallback bank config
    IF v_bank_config IS NULL THEN
        v_bank_config := ROW('MB', '0336668386', 'NGUYEN MINH NHAT');
    END IF;

    -- Generate QR URL
    v_qr_url := 'https://img.vietqr.io/image/'
        || v_bank_config.bank_code || '-'
        || v_bank_config.account_no
        || '-compact2.png?amount=' || v_total_price::TEXT
        || '&addInfo=' || v_transfer_content
        || '&accountName=' || REPLACE(v_bank_config.account_name, ' ', '+');

    -- Create order in unified orders table
    INSERT INTO orders (
        order_code,
        user_id,
        order_type,
        status,
        payment_status,
        subtotal,
        total_amount,
        deposit_amount,
        shipping_fee,
        created_at,
        updated_at
    ) VALUES (
        v_code_child,
        p_user_id,
        'ready_made',
        'pending',
        'pending',
        v_total_price,
        v_total_price,
        v_total_price,
        0,
        NOW(),
        NOW()
    ) RETURNING id INTO v_order_id;

    -- Create order item
    INSERT INTO order_items (
        order_id,
        product_id,
        sku,
        name,
        quantity,
        unit_price,
        total_price,
        configuration,
        created_at
    ) VALUES (
        v_order_id,
        p_product_id,
        p_product_sku,
        p_product_name,
        p_quantity,
        p_unit_price,
        v_total_price,
        COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('product_type', p_product_type),
        NOW()
    );

    -- Create payment record
    INSERT INTO payments (
        order_id,
        transaction_code,
        amount,
        status,
        method,
        gateway_response,
        created_at,
        updated_at
    ) VALUES (
        v_order_id,
        v_transfer_content,
        v_total_price,
        'pending',
        'QR',
        jsonb_build_object(
            'qr_url', v_qr_url,
            'bank_code', v_bank_config.bank_code,
            'account_no', v_bank_config.account_no,
            'account_name', v_bank_config.account_name,
            'reference_code', v_code_child,
            'expires_at', (NOW() + INTERVAL '30 minutes')
        ),
        NOW(),
        NOW()
    );

    -- Return success with all order details
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'code_child', v_code_child,
        'customer_code', v_customer_code,
        'transfer_content', v_transfer_content,
        'amount', v_total_price,
        'qr_url', v_qr_url,
        'stock_before', v_current_stock,
        'stock_after', v_current_stock - p_quantity,
        'bank_info', jsonb_build_object(
            'bank_code', v_bank_config.bank_code,
            'account_no', v_bank_config.account_no,
            'account_name', v_bank_config.account_name
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Rollback happens automatically, return error
        RETURN jsonb_build_object(
            'success', false,
            'error', 'DATABASE_ERROR',
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION place_order_with_stock_check TO authenticated;

COMMENT ON FUNCTION place_order_with_stock_check IS
'Atomically creates an order while checking and deducting stock.
Uses FOR UPDATE lock to prevent race conditions and overselling.
Returns JSONB with success status and order details or error info.';
