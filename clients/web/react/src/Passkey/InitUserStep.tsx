import React, { useEffect } from "react";
import { useDispatch, useSelector, RootStateOrAny } from "react-redux";
import { Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { history } from "../_helpers";
import { userActions } from "../_actions";

const styles = require("../_components/component.module.css");

/**
 * Transitionary page that is used to log in the user and to set auth tokens used for APIs - This step should only be reached after a successful registration
 * @returns User is routed back to the login screen, with all credentials removed from the browser
 */
const InitUserStep = function () {
  const { t } = useTranslation();

  const user = useSelector((state: RootStateOrAny) => state.users);

  const dispatch = useDispatch();

  /**
   * Once a user is configured, ensure that they have a user token
   * If the user has a token, allow them to proceed to the key registration success page
   */
  useEffect(() => {
    dispatch(userActions.getCurrentAuthenticatedUser());
  }, []);

  useEffect(() => {
    const token = user?.token;

    if (token !== undefined) {
      history.push("/");
    }
  }, [user]);

  return (
    <div className={styles.default["textCenter"]}>
      <Spinner animation="border" role="status" variant="primary" />
      <h2>{t("init-user")}</h2>
    </div>
  );
};

export default InitUserStep;
