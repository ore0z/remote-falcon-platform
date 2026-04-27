import { useState } from 'react';

import { useMutation } from '@apollo/client';
import { Grid, CardActions, Divider, Typography, Switch, Stack, TextField } from '@mui/material';
import _ from 'lodash';

import MainCard from '../../../../ui-component/cards/MainCard';
import { useDispatch, useSelector } from '../../../../store';
import { setShow } from '../../../../store/slices/show';
import { UPDATE_PREFERENCES } from '../../../../utils/graphql/controlPanel/mutations';
import { showAlert } from '../../globalPageHelpers';
import {savePreferencesService} from "../../../../services/controlPanel/mutations.service";

const Notifications = ({ setShowLinearProgress }) => {
  const dispatch = useDispatch();
  const { show } = useSelector((state) => state.show);

  const [fppHeartbeatRenotifyAfterMinutes, setFppHeartbeatRenotifyAfterMinutes] = useState(show?.preferences?.notificationPreferences?.fppHeartbeatRenotifyAfterMinutes);

  const [updatePreferencesMutation] = useMutation(UPDATE_PREFERENCES);

  const handleFppHeartbeatSwitch = (event, value) => {
    setShowLinearProgress(true);
    const updatedPreferences = _.cloneDeep({
      ...show?.preferences,
      notificationPreferences: {
        ...show?.preferences?.notificationPreferences,
        enableFppHeartbeat: value
      }
    });
    if(value && show?.preferences?.notificationPreferences?.fppHeartbeatIfControlEnabled == null) {
      updatedPreferences.notificationPreferences.fppHeartbeatIfControlEnabled = false;
    }
    if(value && show?.preferences?.notificationPreferences?.fppHeartbeatRenotifyAfterMinutes == null) {
      setFppHeartbeatRenotifyAfterMinutes(30);
      updatedPreferences.notificationPreferences.fppHeartbeatRenotifyAfterMinutes = 30;
    }
    savePreferencesService(updatedPreferences, updatePreferencesMutation, (response) => {
      dispatch(
        setShow({
          ...show,
          preferences: {
            ...updatedPreferences
          }
        })
      );
      showAlert(dispatch, response?.toast);
      setShowLinearProgress(false);
    });
  };

  const handleFppHeartbeatIfControlEnabledSwitch = (event, value) => {
    setShowLinearProgress(true);
    const updatedPreferences = _.cloneDeep({
      ...show?.preferences,
      notificationPreferences: {
        ...show?.preferences?.notificationPreferences,
        fppHeartbeatIfControlEnabled: value
      }
    });
    savePreferencesService(updatedPreferences, updatePreferencesMutation, (response) => {
      dispatch(
          setShow({
            ...show,
            preferences: {
              ...updatedPreferences
            }
          })
      );
      showAlert(dispatch, response?.toast);
      setShowLinearProgress(false);
    });
  };

  const savePreferences = () => {
    if(fppHeartbeatRenotifyAfterMinutes < 5) {
      showAlert(dispatch, { alert: 'warning', message: 'Renotify must be greater than 5' });
      return;
    }
    setShowLinearProgress(true);
    const updatedPreferences = _.cloneDeep({
      ...show?.preferences,
      notificationPreferences: {
        ...show?.preferences?.notificationPreferences,
        fppHeartbeatRenotifyAfterMinutes
      }
    });
    savePreferencesService(updatedPreferences, updatePreferencesMutation, (response) => {
      if (response?.success) {
        dispatch(
          setShow({
            ...show,
            preferences: {
              ...updatedPreferences
            }
          })
        );
      }
      showAlert(dispatch, response?.toast);
      setShowLinearProgress(false);
    });
  };

  return (
    <Grid item xs={12}>
      <MainCard content={false}>
        <Divider />
        <CardActions>
          <Grid container alignItems="center" justifyContent="space-between" spacing={2}>
            <Grid item xs={12} md={6} lg={4}>
              <Typography variant="h4">
                FPP Plugin Health
              </Typography>
              <Typography component="div" variant="caption">
                Enable notifications in the event FPP is no longer communicating with Remote Falcon.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <Switch color="primary" checked={show?.preferences?.notificationPreferences?.enableFppHeartbeat} onChange={handleFppHeartbeatSwitch} />
            </Grid>
          </Grid>
        </CardActions>
        <Divider />
        {show?.preferences?.notificationPreferences?.enableFppHeartbeat && (
          <>
            <CardActions>
              <Grid container alignItems="center" justifyContent="space-between" spacing={2}>
                <Grid item xs={12} md={6} lg={4} ml={2}>
                  <Typography variant="h4">
                    Notify Only If Viewer Control is Enabled
                  </Typography>
                  <Typography component="div" variant="caption">
                    Send FPP health notifications only if Viewer Control is enabled.
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6} lg={4}>
                  <Switch color="primary" checked={show?.preferences?.notificationPreferences?.fppHeartbeatIfControlEnabled} onChange={handleFppHeartbeatIfControlEnabledSwitch} />
                </Grid>
              </Grid>
            </CardActions>
            <Divider />
            <CardActions>
              <Grid container alignItems="center" justifyContent="space-between" spacing={2}>
                <Grid item xs={12} md={6} lg={4} ml={2}>
                  <Stack direction="row" spacing={2} pb={1}>
                    <Typography variant="h4">Renotify After Minutes</Typography>
                  </Stack>
                  <Typography component="div" variant="caption">
                    Wait a specified number of minutes before sending another notification
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6} lg={4}>
                  <TextField
                      type="number"
                      fullWidth
                      label="Renotify After Minutes"
                      onChange={(e) => setFppHeartbeatRenotifyAfterMinutes(parseInt(e?.target?.value, 10))}
                      value={fppHeartbeatRenotifyAfterMinutes}
                      onBlur={savePreferences}
                  />
                </Grid>
              </Grid>
            </CardActions>
          </>
        )}
        <Divider />
      </MainCard>
    </Grid>
  );
};

export default Notifications;
