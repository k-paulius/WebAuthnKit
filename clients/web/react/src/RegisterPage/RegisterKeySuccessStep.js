import React, { useState, useEffect, useRef, Profiler } from 'react';
import { Button, InputGroup, FormControl, } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';

import { history } from '../_helpers';
import { userActions, credentialActions, alertActions } from '../_actions';


const RegisterKeySuccessStep = ({ setForm, formData, navigation }) => {

  const dispatch = useDispatch();

  const validNickname = useSelector(state => state.credentials.validNickname);
  const updateComplete = useSelector(state => state.credentials.updateComplete);

  useEffect(() => {
    dispatch(userActions.getCurrentAuthenticatedUser());  // Get the jwt token after signup
  }, []);

  useEffect(() => {
    if (validNickname){
      updateCredential(validNickname);
    }
  },[validNickname]);

  useEffect(() => {
    if (updateComplete) {
      history.push('/');
    }
  },[updateComplete]);

  const { username, pin, nickname, credential } = formData;

  async function updateCredential(nickname){
    console.log("RegisterKeySuccessStep updateCredential() nickname:", nickname);
    try {
      let ls_credential = JSON.parse(localStorage.getItem('credential'));
      console.log("RegisterKeySuccessStep updateCredential() ls_credential:", ls_credential);

      let credentialToUpdate = {
        credential: { 
          credentialId: { 
            base64: ls_credential.id
          }
        }, 
        credentialNickname: { 
          value: nickname 
        }
      }

      dispatch(credentialActions.update(credentialToUpdate));

    } catch (err) {

      console.error("RegisterKeySuccessStep continueStep() error");
      console.error(err);
      dispatch(alertActions.error(err.message));

    }
    localStorage.removeItem('credential');

  }

  function continueStep() {
    dispatch(credentialActions.validateCredentialNickname(nickname));
  }

  return (
    <>
        <center>
          <h2>Security Key Added</h2>
          <label>You have successfully registered your security key.</label>
        </center>
        <div className="form mt-2">
          <div>
            <label>Give your security key a nickname.</label>
            <InputGroup className="mb-3">
              <InputGroup.Prepend>
                <InputGroup.Text id="basic-addon1"><img src="https://media.yubico.com/media/catalog/product/5/n/5nfc_hero_2021.png" width="20" height="20"></img></InputGroup.Text>
              </InputGroup.Prepend>
              <FormControl
                name="nickname"
                placeholder="Security Key"
                aria-label="Nickname"
                aria-describedby="basic-addon1"
                onChange={setForm}
              />
            </InputGroup>
          </div>
          <div>
            <Button onClick={() => continueStep()} variant="primary btn-block mt-3">Continue</Button>
          </div>
        </div>
    </>
  );
};

export default RegisterKeySuccessStep;