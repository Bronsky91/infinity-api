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


$api_url = 'https://infinity.arcanecollector.com';

function download_file_from_api() {
    global $api_url;

    // Verify nonce for security
    check_ajax_referer('security_nonce', 'security');

    // Retrieve query parameters from GET request
    $params = array();
    if (isset($_GET['type'])) {
        $params['type'] = sanitize_text_field($_GET['type']);
    }
    if (isset($_GET['size'])) {
        $params['size'] = sanitize_text_field($_GET['size']);
    }
    if (isset($_GET['grid'])) {
        $params['grid'] = sanitize_text_field($_GET['grid']);
    }
    if (isset($_GET['time_of_day'])) {
        $params['time_of_day'] = sanitize_text_field($_GET['time_of_day']);
    }
    if (isset($_GET['season'])) {
        $params['season'] = sanitize_text_field($_GET['season']);
    }
    if (isset($_GET['middle_event'])) {
        $params['middle_event'] = sanitize_text_field($_GET['middle_event']);
    }
    if (isset($_GET['center'])) {
        $params['center'] = sanitize_text_field($_GET['center']);
    }

    // Construct the URL with query parameters if any exist
    $url = $api_url . '/download';
    if (!empty($params)) {
        $url .= '?' . http_build_query($params);
    }

    // Initialize cURL session
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);

    // Execute cURL request
    $response = curl_exec($ch);

    if (curl_errno($ch)) {
        echo 'Error:' . curl_error($ch);
    } else {
        // Separate headers and body
        $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $header = substr($response, 0, $header_size);
        $body = substr($response, $header_size);

        // Pass headers to the client
        $header_lines = explode("\r\n", $header);
        foreach ($header_lines as $header_line) {
            if (!empty($header_line)) {
                header($header_line);
            }
        }

        // Output the body
        echo $body;
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
    $filename = isset($_POST['filename']) ? sanitize_text_field($_POST['filename']) : '';

    if (empty($email)) {
        wp_send_json_error('Email address is required.');
        wp_die();
    }

    if (empty($filename)) {
        wp_send_json_error('Filename is required.');
        wp_die();
    }

    // Prepare POST data
    $post_data = json_encode(array('email' => $email, 'filename' => $filename));

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
