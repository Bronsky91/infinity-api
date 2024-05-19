<?php
/**
 * Flatsome functions and definitions
 *
 * @package flatsome
 */

require get_template_directory() . '/inc/init.php';

flatsome()->init();

/**
 * It's not recommended to add any custom code here. Please use a child theme
 * so that your customizations aren't lost during updates.
 *
 * Learn more here: https://developer.wordpress.org/themes/advanced-topics/child-themes/
 */


// To bad here's my custom code.

function custom_override_checkout_fields( $fields ) {
    // List of fields to unset (remove)
    unset($fields['billing']['billing_first_name']);
    unset($fields['billing']['billing_last_name']);
    unset($fields['billing']['billing_company']);
    unset($fields['billing']['billing_address_1']);
    unset($fields['billing']['billing_address_2']);
    unset($fields['billing']['billing_city']);
    unset($fields['billing']['billing_postcode']);
    unset($fields['billing']['billing_country']);
    unset($fields['billing']['billing_state']);
    unset($fields['billing']['billing_phone']);

    return $fields;
}

function enqueue_custom_scripts() {
    // Enqueue jQuery
    wp_enqueue_script('jquery');

    // Localize script to pass AJAX URL and nonce
    wp_localize_script('jquery', 'infinity_vars', array(
        'ajaxurl' => admin_url('admin-ajax.php'),
        'security' => wp_create_nonce('security_nonce')
    ));
}


$api_url = 'https://d0ff-184-98-10-147.ngrok-free.app';

function download_file_from_api() {
    global $api_url;

    // Verify nonce for security
    check_ajax_referer('security_nonce', 'security');

    // Initialize cURL session
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $api_url . '/download');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    // Execute cURL request
    $response = curl_exec($ch);

    if (curl_errno($ch)) {
        echo 'Error:' . curl_error($ch);
    } else {
        header('Content-Type: image/jpeg'); // Adjust content type as needed
        echo $response;
    }

    // Close cURL session
    curl_close($ch);

    // Terminate to avoid further output
    wp_die();
}

function send_email_via_api() {
    global $api_url;
    
    // Verify nonce for security
    check_ajax_referer('security_nonce', 'security');

    // Get the email address from the POST request
    $email = isset($_POST['email']) ? sanitize_email($_POST['email']) : '';

    if (empty($email)) {
        wp_send_json_error('Email address is required.');
        wp_die();
    }


    // Prepare POST data
    $post_data = json_encode(array('email' => $email));

    // Initialize cURL session
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $api_url . '/sendmap');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        'Content-Type: application/json',
        'Content-Length: ' . strlen($post_data)
    ));
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);

    // Execute cURL request
    $response = curl_exec($ch);

    if (curl_errno($ch)) {
        echo 'Error:' . curl_error($ch);
    } else {
        header('Content-Type: application/json'); // Adjust content type as needed
        echo $response;
    }

    // Close cURL session
    curl_close($ch);

    // Terminate to avoid further output
    wp_die();
}

add_filter( 'woocommerce_checkout_fields' , 'custom_override_checkout_fields' );

add_action('wp_enqueue_scripts', 'enqueue_custom_scripts');

add_action('wp_ajax_download_file', 'download_file_from_api');
add_action('wp_ajax_nopriv_download_file', 'download_file_from_api');
add_action('wp_ajax_send_email', 'send_email_via_api');
add_action('wp_ajax_nopriv_send_email', 'send_email_via_api');
