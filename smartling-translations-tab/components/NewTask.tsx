import React, {useState, useContext, ChangeEvent} from 'react'
import {Button, Flex, Grid, Select, Stack, Switch, Badge, Text, useToast} from '@sanity/ui'

import {TranslationContext} from './TranslationContext'
import {TranslationLocale} from '../types'

type Props = {
  locales: TranslationLocale[]
  refreshTask: () => Promise<void>
  documentLocalisationType: 'field' | 'document'
}

type LocaleCheckboxProps = {
  locale: TranslationLocale
  toggle: (locale: string, checked: boolean) => void
  checked: boolean
}

const LocaleCheckbox = ({locale, toggle, checked}: LocaleCheckboxProps) => {
  return (
    <Button
      mode="ghost"
      onClick={() => {
        toggle(locale.localeId, !checked)
      }}
      disabled={locale.enabled === false}
      style={{cursor: `pointer`}}
      radius={2}
    >
      <Flex align="center" gap={3}>
        <Switch
          style={{pointerEvents: `none`}}
          disabled={locale.enabled === false}
          checked={checked}
          //not needed because of above toggle logic, but silence React warnings.
          onChange={() => {}}
        />
        <Text size={1} weight="semibold">
          {locale.description}
        </Text>
      </Flex>
    </Button>
  )
}

export const NewTask = ({locales, refreshTask, documentLocalisationType}: Props) => {
  // Lets just stick to the canonical document id for keeping track of
  // translations
  const [selectedLocales, setSelectedLocales] = useState<React.ReactText[]>([])
  const [selectedWorkflowUid, setSelectedWorkflowUid] = useState<string>()
  const [isBusy, setIsBusy] = useState(false)

  const context = useContext(TranslationContext)
  const toast = useToast()

  const toggleLocale = (locale: string, selected: boolean) => {
    if (!selected) {
      setSelectedLocales(selectedLocales.filter((l) => l !== locale))
    } else if (!selectedLocales.includes(locale)) {
      setSelectedLocales([...selectedLocales, locale])
    }
  }

  const createTask = async () => {
    if (!context) {
      toast.push({
        title: 'Unable to create task: missing context',
        status: 'error',
        closable: true,
      })
      return
    }

    setIsBusy(true)

    context
      .exportForTranslation(context.documentId)
      .then((serialized) => {
        context.adapter.createTask(
          context.documentId,
          serialized,
          selectedLocales as string[],
          context.secrets,
          selectedWorkflowUid
        )
      })
      .then(() => {
        toast.push({
          title: 'Job successfully created',
          status: 'success',
          closable: true,
        })

        /** Reset form fields */
        setSelectedLocales([])
        setSelectedWorkflowUid('')

        /** Update task data in TranslationView */
        refreshTask()
      })
      .catch((err) => {
        let errorMsg
        if (err instanceof Error) {
          errorMsg = err.message
        } else {
          errorMsg = err ? String(err) : null
        }

        toast.push({
          title: `Error creating translation job`,
          description: errorMsg,
          status: 'error',
          closable: true,
        })
      })
      .finally(() => {
        setIsBusy(false)
      })
  }

  const possibleLocales = locales.filter((locale) => locale.enabled !== false)

  return (
    <Stack paddingTop={4} space={4}>
      <Text as="h2" weight="semibold" size={2}>
        Create New Translation Job
        <Badge tone="default" style={{width: 'fit-content'}} marginLeft={3}>
          {documentLocalisationType === 'field' ? 'field' : 'document'} level
        </Badge>
      </Text>
      <Stack space={3}>
        <Flex align="center" justify="space-between">
          <Text weight="semibold" size={1}>
            {possibleLocales.length === 1 ? `Select locale` : `Select locales`}
          </Text>

          <Button
            fontSize={1}
            padding={2}
            text="Toggle All"
            onClick={() =>
              setSelectedLocales(
                possibleLocales.length === selectedLocales.length
                  ? // Disable all
                    []
                  : // Enable all
                    locales
                      .filter((locale) => locale.enabled !== false)
                      .map((locale) => locale.localeId)
              )
            }
          />
        </Flex>

        <Grid columns={[1, 1, 2, 3]} gap={1}>
          {(locales || []).map((l) => (
            <LocaleCheckbox
              key={l.localeId}
              locale={l}
              toggle={(locale, checked) => toggleLocale(locale, checked)}
              checked={selectedLocales.includes(l.localeId)}
            />
          ))}
        </Grid>
      </Stack>

      {context?.workflowOptions && context.workflowOptions.length > 0 && (
        <Stack space={3}>
          <Text weight="semibold" size={1} as="label" htmlFor="workflow-select">
            Select translation workflow
          </Text>
          <Grid columns={[1, 1, 2]}>
            <Select
              id="workflowSelect"
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                setSelectedWorkflowUid(e.target.value)
              }}
            >
              <option>Default locale workflows</option>
              {context.workflowOptions.map((w) => (
                <option key={`workflow-opt-${w.workflowUid}`} value={w.workflowUid}>
                  {w.workflowName}
                </option>
              ))}
            </Select>
          </Grid>
        </Stack>
      )}

      <Button
        onClick={createTask}
        disabled={isBusy || !selectedLocales.length}
        tone="positive"
        text={isBusy ? 'Creating Job...' : 'Create Job'}
      />
    </Stack>
  )
}
