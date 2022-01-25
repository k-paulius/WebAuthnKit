import React, { useState, useRef, ReactElement } from "react";

import { create } from "@github/webauthn-json";
import { Button, Modal, Alert } from "react-bootstrap";
import base64url from "base64url";
import cbor from "cbor";
import axios from "axios";
import validate from "validate.js";
import { useDispatch } from "react-redux";
import { credentialActions, alertActions } from "../../_actions";
import ServerVerifiedPin from "../ServerVerifiedPin/ServerVerifiedPin";
// eslint-disable-next-line camelcase
import aws_exports from "../../aws-exports";

// eslint-disable-next-line camelcase
axios.defaults.baseURL = aws_exports.apiEndpoint;

/**
 * Component used to add a new credential
 */
const AddCredential = function () {
  const [showAdd, setShowAdd] = useState(false);
  // Will load the SVPIN component if the new credential is non-FIDO2
  const [serverVerifiedPin, setServerVerifiedPin] = useState<ReactElement>();
  const [nickname, setNickname] = useState("");
  const [isResidentKey, setIsResidentKey] = useState(false);
  const [invalidNickname, setInvalidNickname] = useState(undefined);
  const [submitted, setSubmitted] = useState(false);
  const dispatch = useDispatch();

  /**
   * Closes the modal for registering a new credential
   * @returns
   */
  const handleClose = () => setShowAdd(false);
  const handleShow = () => {
    setNickname("");
    setShowAdd(true);
  };
  // Default PIN used if this is a FIDO2 key
  const defaultInvalidPIN = -1;
  const constraints = {
    keyName: {
      length: {
        minimum: 1,
        maximum: 20,
      },
    },
  };

  /**
   * Called when the user submits the new key registration
   * First the nickname of the key is validated, then the register method in this component is called
   */
  const handleSaveAdd = () => {
    setSubmitted(true);

    const result = validate({ keyName: nickname }, constraints);
    if (result) {
      setInvalidNickname(result.keyName.join(". "));
    } else {
      setInvalidNickname(undefined);
      setShowAdd(false);
      register();
    }
  };

  /**
   * Updates the value of the checkbox if the user wishes to write a resident credential
   * @param e Event triggered by a user action (clicking the checkbox)
   */
  const handleCheckboxChange = (e) => {
    const { target } = e;
    const value = target.type === "checkbox" ? target.checked : target.value;
    setIsResidentKey(value);
  };

  function getUV(attestationObject) {
    const attestationBuffer = base64url.toBuffer(attestationObject);
    const attestationStruct = cbor.decodeAllSync(attestationBuffer)[0];
    const buffer = attestationStruct.authData;

    const flagsBuf = buffer.slice(32, 33);
    const flagsInt = flagsBuf[0];
    const flags = {
      up: !!(flagsInt & 0x01),
      uv: !!(flagsInt & 0x04),
      at: !!(flagsInt & 0x40),
      ed: !!(flagsInt & 0x80),
      flagsInt,
    };
    return flags.uv;
  }

  /**
   * If the key is a U2F key, then a SVPIN needs to be configured on key registration
   * This promise allows the ServerVerifiedPIN to be initialized by the WebAuthN component through a promise
   * This Step will configure the ServerVerifiedPIN components properties, and await for a Save response to be sent from the component
   * @param challengeResponse sent from WebAuthN component that is used to dispatch the event to start PIN registration
   * @returns A promise containing the PIN to be used for registration in the WebAuthN component
   */
  const UVPromise = (): Promise<{ value: number }> => {
    return new Promise((resolve, reject) => {
      const svpinCreateProps = {
        type: "create",
        saveCallback: resolve,
        closeCallback: reject,
      };
      console.log("SignUpStep UVPromise(): ", svpinCreateProps);
      setServerVerifiedPin(<ServerVerifiedPin {...svpinCreateProps} />);
    });
  };

  /**
   * If the key is a U2F key, then a SVPIN needs to be configured on key registration
   * This promise allows the ServerVerifiedPIN to be initialized by the WebAuthN component through a promise
   * This Step will configure the ServerVerifiedPIN components properties, and await for a Save response to be sent from the component
   * @param challengeResponse sent from WebAuthN component that is used to dispatch the event to start PIN registration
   * @returns A promise containing the PIN to be used for registration in the WebAuthN component
   */
  async function registerUV(challengeResponse) {
    dispatch(credentialActions.getUV(challengeResponse));
    const pinResult = await UVPromise();
    console.log("SignUpStep PIN Result: ", pinResult.value);
    return pinResult.value;
  }

  /**
   * Primary logic of this method
   * Calls to the register API, and creates the credential on the security key
   * Removing requireAuthenticatorAttachment will allow for the registration of both roaming authenticator and platform
   * Current state will only allow for roaming authenticators
   */
  const register = async () => {
    console.log("register");
    console.log("nickname: ", nickname);

    axios
      .post("/users/credentials/fido2/register", {
        nickname,
        requireResidentKey: isResidentKey,
        requireAuthenticatorAttachment: "CROSS_PLATFORM",
      })
      .then(async (startRegistrationResponse) => {
        console.log(startRegistrationResponse);

        const { requestId } = startRegistrationResponse.data;

        const publicKey = {
          publicKey:
            startRegistrationResponse.data.publicKeyCredentialCreationOptions,
        };
        console.log("publlicKey: ", publicKey);

        create(publicKey)
          .then(async (makeCredentialResponse) => {
            console.log(
              `make credential response: ${JSON.stringify(
                makeCredentialResponse
              )}`
            );

            const uv = getUV(makeCredentialResponse.response.attestationObject);
            console.log("uv: ", uv);

            const challengeResponse = {
              credential: makeCredentialResponse,
              requestId,
              pinSet: startRegistrationResponse.data.pinSet,
              pinCode: defaultInvalidPIN,
              nickname,
            };

            console.log("challengeResponse: ", challengeResponse);

            if (uv === true) {
              console.log("finishRegistration: ", challengeResponse);
              dispatch(credentialActions.registerFinish(challengeResponse));
            } else {
              const uvPin = await registerUV(challengeResponse);
              console.log("AddCredential, new Key PIN is: ", uvPin);
              challengeResponse.pinCode = uvPin;
              dispatch(credentialActions.registerFinish(challengeResponse));
            }
          })
          .catch((error) => {
            console.error(error);
            dispatch(alertActions.error(error.message));
          });
      })
      .catch((error) => {
        console.error(error);
        dispatch(alertActions.error(error.message));
      });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNickname(value);

    console.log(value);

    const result = validate({ keyName: value }, constraints);
    if (result) {
      console.log("Here");
      setInvalidNickname(result.keyName.join(". "));
    } else {
      setInvalidNickname(undefined);
    }
  };

  const inputRef = useRef(null);

  return (
    <>
      <Modal show={showAdd} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Add a new security key</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <label>Nickname</label>
          <input
            type="text"
            name="nickname"
            autoFocus
            value={nickname}
            ref={inputRef}
            onChange={handleChange}
            className={`form-control${
              submitted && invalidNickname ? " is-invalid" : ""
            }`}
            onKeyPress={(ev) => {
              if (ev.key === "Enter") {
                handleSaveAdd();
                ev.preventDefault();
              }
            }}
          />
          {invalidNickname ? (
            <Alert variant="danger">{invalidNickname}</Alert>
          ) : null}
          <br />
          <label>
            <input
              name="isResidentKey"
              type="checkbox"
              checked={isResidentKey}
              onChange={handleCheckboxChange}
            />{" "}
            Enable usernameless login with this key
            <br />
            <em>
              <small>
                Note: Passwordless requires a FIDO2 device and a browser that
                supports it.
              </small>
            </em>
          </label>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveAdd}>
            Register security key
          </Button>
        </Modal.Footer>
      </Modal>
      <Button variant="primary" onClick={handleShow}>
        Add a new security key
      </Button>
      {serverVerifiedPin}
    </>
  );
};

export default AddCredential;
