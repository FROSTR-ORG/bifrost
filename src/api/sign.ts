import { SharePackage, SignRequest } from '@/types/index.js'

export function handle_sign_request (
  event : SignRequest
) {
  // Verify sign request event (nonce tweaks, psig).
  
  // Check if we have handled it before?
  
  // Go through the custom signing process
  // - need a wrapper method to handle the 
  //   session id and tweaking of the nonces.

  // Create your own sign request, and publish it in response.
}

export function create_sign_request (
  msg    : string,
  signer : SharePackage
) {

}

export function verify_sign_request () {

}
